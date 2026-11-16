import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch();
await mkdir('docs/auditoria-v4/mockups',{recursive:true});
const page=await browser.newPage();
const results=[];
for(const [view,width,height] of [['entry',1440,900],['lobby',1440,900],['host',1440,900],['host',390,844],['player',390,844],['tv',1920,1080],['result',1440,900],['victory',1440,900],['entry',320,720],['lobby',390,844],['host',320,720]]){
 await page.setViewportSize({width,height});
 await page.goto(pathToFileURL(resolve('docs/auditoria-v4/proposta.html')).href+'?view='+view+'&capture=1');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`docs/auditoria-v4/mockups/${view}-${width}.jpg`,fullPage:true,type:'jpeg',quality:85});
 results.push({view,width,height,...await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,fontChanga:document.fonts.check('16px Changa'),fontNunito:document.fonts.check('16px Nunito'),scrollHeight:document.documentElement.scrollHeight}))});
}
await writeFile('docs/auditoria-v4/mockups/resultados.json',JSON.stringify(results,null,2));
console.log(results);await browser.close();
