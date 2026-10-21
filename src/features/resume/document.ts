import { definitions,sortedEntries,plain,escapeHtml,type Resume,type ModuleId } from './schema'
export interface DocumentBlock { key:string;section:string;title:string;meta:string;html:string }
function chunks(html:string,max=460):string[]{
 if(plain(html).length<=max)return [html]
 let paragraphs=html.match(/<(?:p|li|div)\b[^>]*>[\s\S]*?<\/(?:p|li|div)>/gi)||[html]
 // Preserve pasted text outside block tags instead of silently dropping it.
 if(plain(paragraphs.join(''))!==plain(html))paragraphs=[html]
 const result:string[]=[]
 for(const paragraph of paragraphs){const text=plain(paragraph);if(text.length<=max){result.push(paragraph);continue}for(let i=0;i<text.length;i+=max)result.push('<p>'+escapeHtml(text.slice(i,i+max)).replace(/\n/g,'<br/>')+'</p>')}
 return result
}
export function documentBlocks(resume:Resume):DocumentBlock[]{
 const result:DocumentBlock[]=[]
 for(const id of resume.order){const module=resume.modules[id];if(!module.visible)continue;const def=definitions.find(d=>d.id===id)!;const entries=sortedEntries(resume,id)
 for(const [index,entry] of entries.entries()){
 let title=entry.name||entry.salutation||''
 let meta=[entry.start,entry.end].filter(Boolean).join(' — ')
 if(['education','campus','internship','work','project'].includes(id)||id.startsWith('custom'))meta=[meta,entry.role,entry.major,entry.degree].filter(Boolean).join(' · ')
 let html=entry.content||''
 if(id==='intention'){title=entry.role||'';meta=[entry.city,entry.salary,entry.status].filter(Boolean).join(' · ')}
 if(['skills','certificates','interests'].includes(id))html='<ul>'+Object.entries(entry).filter(([k,v])=>k.startsWith('item')&&v.trim()).map(([,v])=>'<li>'+escapeHtml(v)+'</li>').join('')+'</ul>'
 if(id==='exam'){meta=entry.major||'';html='<p>'+[entry.score&&'总分：'+escapeHtml(entry.score),...Array.from({length:5},(_,i)=>[entry['subject'+i],entry['score'+i]].filter(Boolean).map(escapeHtml).join('：'))].filter(Boolean).join('<br/>')+'</p>'}
 if(id==='letter')meta=[entry.author,entry.date].filter(Boolean).join(' · ')
 const parts=chunks(html)
 parts.forEach((part,p)=>result.push({key:entry.id+'-'+p,section:index===0&&p===0?module.name:p>0?module.name+'（续）':'',title:p===0?title:'',meta:p===0?meta:'',html:part}))
 }
 }
 return result
}
export function documentPages(resume:Resume):DocumentBlock[][]{
 const pages:DocumentBlock[][]=[[]];let used=9
 const font=[.84,.92,1,1.08,1.16][resume.layout.font]||1;const line=[1.45,1.6,1.75,1.9,2.05][resume.layout.line]||1.75
 for(const block of documentBlocks(resume)){const cost=3+(block.section?2:0)+Math.ceil((plain(block.html).length+block.meta.length+block.title.length)/29)*font*line/1.75+resume.layout.gap*.6
 if(used+cost>48&&pages[pages.length-1].length){pages.push([]);used=2}pages[pages.length-1].push(block);used+=cost}
 return pages
}
