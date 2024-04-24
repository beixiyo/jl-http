#!/usr/bin/env node
"use strict";var t=require("node:fs"),e=require("node:path");const n=t=>Object.prototype.toString.call(t).slice(8,-1).toLowerCase(),r={string:"string",number:"number",boolean:"boolean",true:"true",false:"false",array:"any[]",object:"object",any:"any",null:"null",undefined:"undefined",function:"Function",Function:"Function",bigInt:"bigInt"};function o(t){const e=r[t];if(e)return e;if("string"==typeof t){let e=t.match(/.+?\[\]/g);if(e?.[0])return e[0]}const o=n(t);return"array"===o?"any[]":o}function c(n,r,o){var c;c=r,t.existsSync(c)||t.mkdirSync(c,{recursive:!0}),t.writeFileSync(e.resolve(process.cwd(),`${r}/${o}`),n,"utf-8")}const s="node_modules/@jl-org/.http",u="temp.cjs",i=e.resolve(process.cwd(),s+"/"+u);!function(){const{input:n,output:r}=function(){const[t,n,r,o]=process.argv;return{input:e.resolve(process.cwd(),r||""),output:e.resolve(process.cwd(),o||"")}}();c((a=n,t.readFileSync(a,"utf-8").replace(/import\s*\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g,((t,e,n)=>`const { ${e} } = require('${n}')`)).replace(/export default/g,"module.exports =")),s,u);var a;const l=function(t){let e="";const{importPath:n="",requestFnName:r,className:c}=t;return e+=n,s(),s(),e+=`export class ${c} {`,s(),i(),s(),e+="}",e;function s(){e+="\n"}function u(){e+="    "}function i(){t.fns?.forEach((t=>{if(Object.keys(t).length<=0)return;s(),u();const n=function(t){if(!t)return"";let e="{";for(const n in t)Object.hasOwnProperty.call(t,n)&&(e+=`\n\t\t${n}: ${o(t[n])}`);return e+="\n\t}",e}(t.args);e+=t.comment?`/** ${t.comment} */\n\t`:"",e+=`static ${t.isAsync?"async ":""}${t.name}(${n?`data: ${n}`:""}) {`,s(),u(),u(),["get","head"].includes(t.method)?e+=`return ${r}.${t.method}('${t.url}'${n?", { query: data }":""})`:e+=`return ${r}.${t.method}('${t.url}'${n?", data":""})`,s(),u(),e+="}",s()}))}}(require(i));t.writeFileSync(r,l,"utf-8"),t.rm(i,(()=>{}))}();
