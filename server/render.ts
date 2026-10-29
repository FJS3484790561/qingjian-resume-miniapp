import { chromium } from 'playwright'
import { Document, Packer, Paragraph, TextRun, ImageRun, Footer, PageNumber, HeadingLevel, AlignmentType, BorderStyle, UnderlineType, type IRunOptions } from 'docx'
import { Parser } from 'htmlparser2'
import sharp from 'sharp'
import { documentBlocks } from '../src/features/resume/document'
import { escapeHtml, type Resume } from '../src/features/resume/schema'
import { templates } from '../src/data/templateCatalog'

export interface RenderInput { resume: Resume; format:'pdf'|'docx'; photo?:Buffer }
function basicDetails(resume:Resume) {
  const b=resume.basic
  return [b.gender,b.age&&b.age+'岁',b.birth,b.city,b.phone,b.email,b.wechat&&'微信 '+b.wechat,
    b.marriage,b.politics,b.ethnicity,b.hometown,b.height&&b.height+' CM',b.weight&&b.weight+' KG',b.school,b.major,b.degree,
    (b.customTitle1||b.customContent1)&&(b.customTitle1||'补充信息 1')+'：'+(b.customContent1||''),
    (b.customTitle2||b.customContent2)&&(b.customTitle2||'补充信息 2')+'：'+(b.customContent2||'')].filter(Boolean).join(' · ')
}
export function documentHtml({resume:r,photo}:RenderInput) {
  const e=escapeHtml,layout=templates.find(t=>t.id===r.layout.templateId)?.layout||'clean'
  const blocks=documentBlocks(r,false)
  const role=r.modules.intention.visible?r.modules.intention.entries[0]?.role||'':''
  const content=blocks.map(b=>`${b.section?'<h2>'+e(b.section)+'</h2>':''}${b.title?'<h3>'+e(b.title)+'</h3>':''}${b.meta?'<p class="meta">'+e(b.meta)+'</p>':''}<div class="rich">${b.html}</div>`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
  @page{size:A4;margin:16mm 16mm 19mm}*{box-sizing:border-box}html{font-family:'Microsoft YaHei','Noto Sans CJK SC',sans-serif;color:#263d32;font-size:${[9,10,11,12,13][r.layout.font]}pt;line-height:${[1.45,1.6,1.75,1.9,2.05][r.layout.line]}}
  body{margin:0;overflow-wrap:anywhere;word-break:normal}h1,h2,h3,p,ul,ol{margin:0}h1{font-size:27pt;color:${r.layout.color};line-height:1.3}h2{font-size:13pt;color:${r.layout.color};border-bottom:1px solid ${r.layout.color};padding-bottom:4pt;margin:${[10,14,18,22,26][r.layout.gap]}pt 0 8pt;break-after:avoid}h3{font-size:11.5pt;margin:7pt 0 2pt;break-after:avoid}
  .heading{display:flex;justify-content:space-between;gap:18pt;border-bottom:2pt solid ${r.layout.color};padding-bottom:14pt;break-inside:avoid}.name{flex:1}.role{font-size:13pt;margin:5pt 0}.details{font-size:9pt;color:#52645a;margin-top:7pt}.photo{width:25mm;height:35mm;object-fit:cover}.meta{color:#52645a;font-size:9pt;break-after:avoid;margin-bottom:4pt}.rich p,.rich div{margin:3pt 0;orphans:2;widows:2}.rich ul,.rich ol{padding-left:18pt}.rich li{margin:2pt 0}
  .editorial h1{font-family:'SimSun',serif;font-size:30pt}.editorial h2{border:0;border-left:3pt solid ${r.layout.color};padding-left:8pt}.sidebar{border-left:8mm solid ${r.layout.color};padding-left:6mm;box-decoration-break:clone}.sidebar h2{background:#f0f4f1;padding:5pt;border:0}
  .cover{height:258mm;break-after:page;padding:45mm 12mm 10mm;border-top:4mm solid ${r.layout.color}}.cover h1{font-size:37pt;margin:13pt 0}.cover .en{letter-spacing:3pt;font-size:10pt}.cover .person{font-size:20pt;margin:24mm 0 6mm}.cover.arch{border-radius:70mm 70mm 0 0;background:#f2f6f1}.cover.line{border-left:2mm solid ${r.layout.color}}.cover.quiet{background:#f5f8f3}.empty{margin-top:25mm;color:#52645a}
  </style></head><body>${r.layout.cover!=='none'?`<section class="cover ${e(r.layout.cover)}"><div class="en">THE NEXT CHAPTER</div><h1>个人简历</h1><p class="person">${e(r.basic.name||'姓名待填写')}</p><p>${e(role||'每一份经历，都值得被看见')}</p></section>`:''}<main class="${layout}"><header class="heading"><div class="name"><h1>${e(r.basic.name||'姓名待填写')}</h1>${role?'<p class="role">'+e(role)+'</p>':''}<p class="details">${e(basicDetails(r))}</p></div>${photo?'<img alt="简历照片" class="photo" src="data:image/png;base64,'+photo.toString('base64')+'">':''}</header>${content||'<p class="empty">还没有填写简历内容。</p>'}</main></body></html>`
}
export async function renderPdf(input:RenderInput,signal:AbortSignal) {
  signal.throwIfAborted()
  const browser=await chromium.launch({headless:true,timeout:15000})
  const abort=()=>{void browser.close()}
  signal.addEventListener('abort',abort,{once:true})
  try {
    signal.throwIfAborted()
    const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'})
    // Rendering must never fetch URLs from resume text or local file paths.
    await context.route('**/*',route=>route.abort())
    const page=await context.newPage()
    await page.setContent(documentHtml(input),{waitUntil:'load',timeout:15000})
    await page.emulateMedia({media:'print'})
    const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',
      footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#606f63"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'})
    signal.throwIfAborted();return pdf
  } finally {signal.removeEventListener('abort',abort);await browser.close()}
}
// Parse sanitized rich text into editable OOXML paragraphs and runs, retaining inline emphasis and lists.
export function richParagraphs(html:string,size:number,line:number):Paragraph[] {
  const result:Paragraph[]=[],styles:string[]=[],lists:{tag:string;index:number}[]=[]
  let runs:TextRun[]=[],hasText=false
  const flush=()=>{if(hasText){result.push(new Paragraph({children:runs,spacing:{after:60,line},widowControl:true}));runs=[];hasText=false}}
  const text=(value:string)=>{if(!value)return;runs.push(new TextRun({text:value,size,bold:styles.some(s=>s==='b'||s==='strong'),italics:styles.some(s=>s==='i'||s==='em'),underline:styles.includes('u')?{type:UnderlineType.SINGLE}:undefined}));hasText=true}
  const parser=new Parser({
    onopentag(tag){
      if(['p','div','li','ul','ol'].includes(tag))flush()
      if(tag==='ul'||tag==='ol')lists.push({tag,index:0})
      if(tag==='li'){const list=lists.at(-1);if(list){list.index++;text('  '.repeat(Math.max(0,lists.length-1))+(list.tag==='ol'?list.index+'. ':'• '))}}
      if(tag==='br'){runs.push(new TextRun({break:1}));hasText=true}
      styles.push(tag)
    },
    ontext:text,
    onclosetag(tag){if(['p','div','li'].includes(tag))flush();if(tag==='ul'||tag==='ol'){flush();lists.pop()}const index=styles.lastIndexOf(tag);if(index>=0)styles.splice(index,1)}
  },{decodeEntities:true})
  parser.write(html);parser.end();flush();return result
}
export async function renderDocx({resume:r,photo}:RenderInput,signal:AbortSignal) {
  signal.throwIfAborted()
  const color=r.layout.color.slice(1),size=[18,20,22,24,26][r.layout.font],line=[290,320,350,380,410][r.layout.line]
  const variant=templates.find(t=>t.id===r.layout.templateId)?.layout||'clean'
  const children:Paragraph[]=[]
  const run=(text:string,options:IRunOptions={})=>new TextRun({text,...options})
  if(r.layout.cover!=='none')children.push(
    new Paragraph({children:[run('THE NEXT CHAPTER',{color,size:24})],spacing:{before:2400,after:400}}),
    new Paragraph({children:[run('个人简历',{size:72,color,bold:true})],spacing:{after:900}}),
    new Paragraph({children:[run(r.basic.name||'姓名待填写',{size:40})]}),
    new Paragraph({children:[run('CURRICULUM VITAE',{color,size:22})],pageBreakBefore:true}))
  children.push(new Paragraph({children:[run(r.basic.name||'姓名待填写',{bold:true,color,size:54})],heading:HeadingLevel.TITLE,keepNext:true}))
  if(photo){const info=await sharp(photo).metadata();const width=90,height=Math.round(width*(info.height||1)/(info.width||1));children.push(new Paragraph({children:[new ImageRun({data:photo,type:'png',transformation:{width,height:Math.min(140,height)}})],alignment:AlignmentType.RIGHT}))}
  children.push(new Paragraph({children:[run(basicDetails(r),{size:18,color:'52645A'})],spacing:{after:180}}))
  for(const block of documentBlocks(r,false)) {
    if(block.section)children.push(new Paragraph({children:[run(block.section,{bold:true,color,size:26})],heading:HeadingLevel.HEADING_1,keepNext:true,spacing:{before:[150,200,260,320,380][r.layout.gap],after:100},
      border:variant==='editorial'?{left:{style:BorderStyle.SINGLE,size:18,color,space:8}}:{bottom:{style:BorderStyle.SINGLE,size:6,color,space:5}},
      shading:variant==='sidebar'?{fill:'F0F4F1'}:undefined}))
    if(block.title)children.push(new Paragraph({children:[run(block.title,{bold:true})],keepNext:!!(block.meta||block.html),spacing:{before:100,after:40}}))
    if(block.meta)children.push(new Paragraph({children:[run(block.meta,{size:18,color:'52645A'})],keepNext:!!block.html,spacing:{after:60}}))
    children.push(...richParagraphs(block.html,size,line))
  }
  if(!documentBlocks(r,false).length)children.push(new Paragraph('还没有填写简历内容。'))
  const document=new Document({creator:'轻简履',title:r.title,styles:{default:{document:{run:{font:{ascii:'Calibri',eastAsia:'Microsoft YaHei',hAnsi:'Calibri'},size,color:'263D32'},paragraph:{spacing:{line,after:80}}}}},
    sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:907,right:907,bottom:1077,left:variant==='sidebar'?1240:907}}},
      footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:[PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES],size:16,color:'606F63'})]})]})},children}]})
  const bytes=await Packer.toBuffer(document);signal.throwIfAborted();return bytes
}
export const renderDocument=(input:RenderInput,signal:AbortSignal)=>input.format==='pdf'?renderPdf(input,signal):renderDocx(input,signal)
