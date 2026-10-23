// Rendered-color review plus the accessibility tree exposed by Edge. This does
// not substitute for a human listening to a screen reader.
export async function accessibilityMetrics(page) {
 const session=await page.context().newCDPSession(page);
 const {nodes}=await session.send('Accessibility.getFullAXTree');
 await session.detach();
 const ax=nodes.filter(node=>!node.ignored);
 const contrast=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});const colors=new Map();
  function rgba(value){if(!colors.has(value)){ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);colors.set(value,[...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v));}return colors.get(value);}
  const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
  const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const failures=[], skipped=[];let checked=0;
  const walker=document.createTreeWalker(document.querySelector('main')||document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,element=node.parentElement,text=node.textContent.trim();
   if(!text||!element||element.closest('script,style,svg,button:disabled,input:disabled,[aria-hidden=true],.sr-only'))continue;
   const range=document.createRange();range.selectNodeContents(node);const rect=range.getBoundingClientRect();
   const style=getComputedStyle(element);if(!rect.width||!rect.height||style.visibility==='hidden')continue;
   const ancestors=[];for(let item=element;item;item=item.parentElement)ancestors.unshift(item);
   if(ancestors.some(item=>getComputedStyle(item).backgroundImage!=='none')){skipped.push(text.slice(0,60));continue;}
   let background=[255,255,255],opacity=1;
   for(const item of ancestors){const s=getComputedStyle(item);background=blend(rgba(s.backgroundColor),background);opacity*=Number(s.opacity);}
   if(opacity<0.1)continue;
   const color=rgba(style.color);const foreground=blend([color[0],color[1],color[2],color[3]*opacity],background);
   const l1=luminance(foreground),l2=luminance(background),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
   const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.666&&Number(style.fontWeight)>=700);
   checked++;if(ratio<(large?3:4.5)-0.03)failures.push({text:text.slice(0,95),ratio:Math.round(ratio*100)/100,required:large?3:4.5,color:style.color,classes:element.className});
  }
  return {checked,failures,skippedGradients:skipped.length};
 });
 return {axMainCount:ax.filter(node=>node.role?.value==='main').length,
   axHeadingNames:ax.filter(node=>node.role?.value==='heading').map(node=>node.name?.value),contrast};
}

export async function keyboardSmoke(page, baseUrl) {
 const steps=[];
 await page.goto(baseUrl+'/dashboard');await page.getByRole('heading',{name:/Welcome back/}).waitFor();
 await page.waitForFunction(()=>document.activeElement?.tagName==='H1');steps.push('Route heading receives focus after data loading');
 await page.evaluate(()=>{document.body.tabIndex=-1;document.body.focus();});
 await page.keyboard.press('Tab');
 if(await page.locator(':focus').innerText()!=='Skip to content')throw new Error('Skip link is not first in keyboard order');
 await page.keyboard.press('Enter');
 if(await page.locator(':focus').getAttribute('id')!=='main-content')throw new Error('Skip link did not focus content');
 steps.push('Tab exposes the skip link; Enter focuses page content');
 const menu=page.getByRole('button',{name:'Toggle menu',exact:true});
 await menu.focus();await page.keyboard.press('Enter');
 await page.keyboard.press('Tab');
 if(await page.locator(':focus').innerText()!=='Dashboard')throw new Error('Mobile navigation tab order is incorrect');
 await page.keyboard.press('Escape');
 if(await menu.getAttribute('aria-expanded')!=='false'||!await menu.evaluate(e=>e===document.activeElement))throw new Error('Escape did not close menu and restore focus');
 steps.push('Mobile menu opens with Enter, exposes links in order, and Escape restores trigger focus');
 await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 await page.waitForURL(/\/workspaces$/);await page.getByRole('heading',{name:'Target jobs',exact:true}).waitFor();
 await page.waitForFunction(()=>document.activeElement?.tagName==='H1');steps.push('Keyboard navigation closes the menu and focuses the next page heading');
 await page.goto(baseUrl+'/upload');await page.getByLabel('Job title',{exact:true}).waitFor();
 const file=page.locator('#resume-file');await page.getByLabel('Job description',{exact:true}).focus();await page.keyboard.press('Tab');
 const chooser=page.getByText('Choose resume',{exact:true});
 if(!await file.evaluate(e=>e===document.activeElement)||await chooser.evaluate(e=>getComputedStyle(e).outlineStyle)==='none')throw new Error('File picker lacks visible keyboard focus');
 steps.push('Native file input remains keyboard accessible with a visible chooser focus indicator');
 await page.goto(baseUrl+'/workspaces');
 const more=page.getByRole('button',{name:'Load more target jobs',exact:true});
 await more.waitFor();await more.focus();await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'Backend engineer',exact:true}).waitFor();
 if(await more.count())throw new Error('Final workspace page retained its next-page action');
 steps.push('Keyboard loads the older target-job page without losing the first page');
 await page.goto(baseUrl+'/dashboard');
 const history=page.getByRole('button',{name:'Load more resume history',exact:true});
 await history.waitFor();await history.focus();await page.keyboard.press('Enter');
 await page.getByRole('status').filter({hasText:'7 resume records loaded.'}).waitFor();
 steps.push('Resume history loads its older page while dashboard totals remain available');
 return steps;
}
