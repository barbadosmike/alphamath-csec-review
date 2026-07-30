import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const failures=[];
const files=[];
const required=["index.html","intake.html","learning-path.html","tutorial.html","simulated-exam.html","math-input.html","assets/data/review-content.js",".nojekyll"];
for(const relative of required)if(!fs.existsSync(path.join(root,relative)))failures.push("Missing: "+relative);
function walk(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())walk(full);else files.push(full);
  }
}
walk(root);
for(const file of files){
  const relative=path.relative(root,file);
  if(!/^[A-Za-z0-9._/-]+$/.test(relative))failures.push("Unsafe filename: "+relative);
  if(!/\.(?:html|js|mjs|css|json|md)$/.test(file))continue;
  if(relative==="review-qa.mjs")continue;
  const source=fs.readFileSync(file,"utf8");
  if(/M-STU-001|MSTU001|m-stu-001|Chyenne|Simon|\/Users\/|source_root|output_root/i.test(source))failures.push("Private token in "+relative);
  if(/CSEC Mathematics, Paper [12], May\/June|Real CSEC Paper|Authentic CSEC Paper/i.test(source))failures.push("Past-paper content marker in "+relative);
  if(file.endsWith(".html")){
    if(!/Sanitized reviewer demonstration/.test(source))failures.push("Missing review notice: "+relative);
    for(const match of source.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)){
      const ref=decodeURIComponent(match[1].split("?")[0]);
      if(/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(ref))continue;
      if(!fs.existsSync(path.resolve(path.dirname(file),ref)))failures.push(relative+" missing "+ref);
    }
  }
  if(file.endsWith(".js")||file.endsWith(".mjs")){
    try{new vm.Script(source,{filename:relative});}catch(error){if(!file.endsWith(".mjs"))failures.push(relative+" parse error: "+error.message);}
  }
}
console.log(JSON.stringify({status:failures.length?"fail":"pass",files:files.length,failures},null,2));
if(failures.length)process.exitCode=1;
