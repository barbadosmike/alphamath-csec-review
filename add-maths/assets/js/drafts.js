(function(){
  "use strict";
  if(!window.AlphaMath) return;

  /*
   * Local draft store for tutor marking.
   *
   * IndexedDB, not localStorage: localStorage holds strings, so a PNG would have
   * to be base64'd (a third larger) into a store with a few megabytes of quota
   * shared across the whole origin. One expanded overlay could exhaust it, and
   * the failure is a thrown QuotaExceededError midway through a review. IndexedDB
   * stores Blobs natively and has room.
   *
   * Keyed on attemptId + tutorUserId + schema version, so:
   *   - two tutors on the same machine never see each other's drafts;
   *   - a schema change orphans old drafts instead of misreading them.
   *
   * This is a LOCAL cache, not a source of truth. It exists so a dropped
   * connection or a closed tab does not cost a tutor their marking. Nothing here
   * is evidence until the server accepts it.
   */

  const DB_NAME = "alphamath-tutor-drafts";
  const DB_VERSION = 1;
  const STORE = "drafts";
  const SCHEMA = "v1";

  let dbPromise = null;

  function open(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if(!window.indexedDB){ reject(new Error("This browser has no IndexedDB.")); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: "key"});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB unavailable."));
    });
    return dbPromise;
  }

  async function tx(mode, run){
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      let request;
      try{ request = run(store); }catch(error){ reject(error); return; }
      /*
       * Resolve the REQUEST'S RESULT, and resolve undefined when there is none.
       *
       * An earlier version returned the IDBRequest itself whenever
       * request.result was undefined — which is exactly the "not found" case. A
       * miss therefore resolved to a truthy IDBRequest, so load() reported a
       * draft that did not exist, and save() then spread that request as the
       * base record, producing an object with no `key` and failing the put with
       * "Evaluating the object store's key path did not yield a value." Silent
       * in the UI: the tutor saw "Saved on this device" while nothing was.
       */
      transaction.oncomplete = () => resolve(request instanceof IDBRequest ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  const keyFor = (attemptId, tutorUserId) => `${SCHEMA}:${attemptId}:${tutorUserId}`;

  const drafts = {
    available(){ return Boolean(window.indexedDB); },

    async load(attemptId, tutorUserId){
      try{
        const record = await tx("readonly", store => store.get(keyFor(attemptId, tutorUserId)));
        return record || null;
      }catch{
        return null;   // a missing local cache is never fatal
      }
    },

    async save(attemptId, tutorUserId, patch){
      const key = keyFor(attemptId, tutorUserId);
      const existing = (await drafts.load(attemptId, tutorUserId)) || {
        key, attemptId, tutorUserId, schema: SCHEMA,
        text: {}, annotations: {}, createdAt: new Date().toISOString()
      };
      const next = {
        ...existing,
        ...patch,
        text: {...existing.text, ...(patch.text || {})},
        annotations: {...existing.annotations, ...(patch.annotations || {})},
        updatedAt: new Date().toISOString()
      };
      await tx("readwrite", store => store.put(next));
      return next;
    },

    // Stores one overlay as a Blob against its item. sketchpadSize travels with
    // it so a restored overlay can be refused if the learner canvas it was drawn
    // against is not the size we are now rendering.
    async saveAnnotation(attemptId, tutorUserId, itemId, blob, sketchpadSize){
      return drafts.save(attemptId, tutorUserId, {
        annotations: {[String(itemId)]: {blob, sketchpadSize, updatedAt: new Date().toISOString()}}
      });
    },

    async clear(attemptId, tutorUserId){
      try{ await tx("readwrite", store => store.delete(keyFor(attemptId, tutorUserId))); }
      catch{ /* nothing to clear */ }
    }
  };

  AlphaMath.drafts = drafts;
})();
