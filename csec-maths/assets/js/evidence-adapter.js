/*
 * CSEC Mathematics → evidence API adapter.
 *
 * WHY THIS FILE EXISTS
 * This client and CSEC Additional Mathematics submit to the SAME server. That
 * server is not forked, branched or special-cased per syllabus, so the only
 * place the two syllabuses may differ is here: in the translation from this
 * client's private attempt shape into the shared wire contract.
 *
 * THE TWO SHAPES
 *   this client   state.responses = {"0": {answer, flagged, drawing}, ...}
 *                 an OBJECT keyed by question position, sparse — a question the
 *                 learner never opened has no key at all.
 *
 *   the API       responses: [{itemId, answerSchemaVersion, answer, parts,
 *                              flagged, drawing, sketchpadSize}, ...]
 *                 a dense ARRAY, one entry per item, each self-identifying.
 *
 * DELIBERATELY PURE
 * No DOM, no storage, no fetch, no clock. Every input is an argument. That is
 * what lets test/adapter-contract.test.mjs run this exact code against the real
 * server validator instead of against a re-typed copy of the contract — so if
 * the contract moves, this fails loudly rather than at a learner's exam.
 */
(function(){
  "use strict";

  const AlphaMathAdapter = {
    /*
     * Iterating `questions` — not Object.keys(responses) — is what makes the
     * array dense. A learner who answered only Q3 has a one-key responses
     * object; the evidence record still needs all ten items, with the untouched
     * ones present and empty. An absent item and an empty item mean different
     * things to a tutor, and only the second is true here.
     */
    toEvidenceResponses(questions, responses){
      const source = responses || {};
      return (questions || []).map((question, index) => {
        const item = source[index] || {};
        return {
          itemId: String(question.label || index + 1),
          // Version 1, not 2: version 2 carries lettered parts (a)/(b)/(c), and
          // this instrument has a single answer field per question. Claiming 2
          // with an empty `parts` would assert a structure never captured.
          answerSchemaVersion: 1,
          answer: String(item.answer || ""),
          parts: {},
          flagged: Boolean(item.flagged),
          drawing: String(item.drawing || ""),
          /* The learner's chosen pad size, not a constant. This must be the size
             the drawing was actually made at: the annotation route rejects a
             tutor overlay whose pixel dimensions do not match, so reporting
             "standard" for an expanded pad would make the item un-markable.
             Falls back to "standard" — the server's own default — for an item
             drawn before the size controls existed. */
          sketchpadSize: ["compact","standard","expanded"].includes(item.sketchpadSize)
            ? item.sketchpadSize
            : "standard"
        };
      });
    },

    /*
     * `locked` is the server's precondition for accepting an attempt at all, and
     * it is passed straight through rather than defaulted to true — an unlocked
     * attempt must be rejected, not quietly promoted.
     */
    toEvidenceAttempt(input){
      const source = input || {};
      return {
        clientAttemptId: source.clientAttemptId,
        instrumentId: source.instrumentId,
        sourceVersion: source.sourceVersion,
        startedAt: source.startedAt,
        submittedAt: source.submittedAt,
        elapsedSeconds: Math.max(0, Math.floor(Number(source.elapsedSeconds) || 0)),
        timedOut: Boolean(source.timedOut),
        locked: Boolean(source.locked),
        learner: {
          externalId: String(source.learner?.externalId || ""),
          displayName: String(source.learner?.displayName || ""),
          school: String(source.learner?.school || ""),
          email: String(source.learner?.email || "")
        },
        responses: AlphaMathAdapter.toEvidenceResponses(source.questions, source.responses)
      };
    }
  };

  // Attached to globalThis as well as window so the Node contract test can load
  // this file directly, with no DOM and no shim.
  globalThis.AlphaMathAdapter = AlphaMathAdapter;
})();
