/* Run on Windows using the installed Chrome. PLAYWRIGHT_MODULE may identify a bundled package. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
(async()=>{
 const output=process.env.P8G_OUTPUT||path.resolve(__dirname,'../../results/p8g_3d_replay');
 const shots=path.join(output,'screenshots');await fs.mkdir(shots,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{
   window.replayWebSocketAttempts=0;
   window.WebSocket=class{constructor(){window.replayWebSocketAttempts++;throw Error('Live socket forbidden in replay test');}};
 });
 const response=await page.goto('http://localhost:8089/replay.html');
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>!!window.p8gReplay,{timeout:60000});
 const checks={},snap=()=>page.evaluate(()=>window.p8gReplay.snapshot());
 const scrub=async value=>page.locator('#scrub').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 checks.page_loaded=true;
 const initial=await snap();
 const model=await page.evaluate(()=>{
   const b=window.p8gReplay.view.boat,names=[];b.model.traverse(o=>{if(o.isMesh)names.push(o.name);});
   return {scene:b.model.name,names,length:b.spec.length,reversed:b.spec.reversed,scale:b.model.scale.x};
 });
 assert.equal(model.scene,'Sketchfab_Scene');assert.ok(model.names.includes('Material3_12'));assert.equal(model.length,5.5);assert.equal(model.reversed,true);
 checks.original_zodiac=model;
 await page.getByRole('button',{name:'Next physical sample',exact:true}).click();assert.equal((await snap()).index,1);
 await page.getByRole('button',{name:'Previous physical sample',exact:true}).click();assert.equal((await snap()).index,0);
 checks.frame_steps=true;
 // Real range input dispatch, followed by rendered pose.
 await scrub('39.4');const cpa=await snap();assert.ok(cpa.index>1000);
 await scrub(String(initial.time));assert.equal((await snap()).trailCount,1);
 await scrub('39.4');assert.deepEqual(await snap(),cpa);
 checks.seek_deterministic_and_no_future_trail=true;
 for(const speed of ['.25','.5','1','2','4']){
   await page.locator('#speed').selectOption(speed);assert.equal(await page.evaluate(()=>window.p8gReplay.clock.speed),Number(speed));
 }
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.waitForFunction(t=>window.p8gReplay.clock.time>t+.1,cpa.time);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.p8gReplay.clock.playing),false);
 checks.play_pause_all_speeds=true;
 await page.getByRole('button',{name:'Jump to Encounter',exact:true}).click();
 assert.ok(Math.abs((await snap()).time-42.54928923856406)<1e-10);
 checks.encounter_jump=true;
 const cameraImages=[];
 for(const name of ['Chase','Top','Free Orbit','Encounter Overview']){
   if(await page.locator('#camera').textContent()!==name)await page.locator('#camera').click();assert.equal(await page.locator('#camera').textContent(),name);
   if(name==='Free Orbit'){
     const before=await page.screenshot();await page.mouse.move(750,500);await page.mouse.down();await page.mouse.move(850,550,{steps:8});await page.mouse.up();
     await page.mouse.wheel(0,-150);await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(830,530,{steps:4});await page.mouse.up();await page.keyboard.up('Shift');
     assert.notDeepEqual(await page.screenshot(),before);
   }
   const file='camera_'+name.replaceAll(' ','_')+'.png';await page.screenshot({path:path.join(shots,file)});cameraImages.push(file);
 }
 await page.keyboard.press('c');assert.equal(await page.locator('#camera').textContent(),'Chase');
 await page.keyboard.press('c');await page.keyboard.press('c');await page.keyboard.press('c');
 const beforeReset=await snap();await page.getByRole('button',{name:'Reset View',exact:true}).click();assert.deepEqual(await snap(),beforeReset);
 checks.cameras={modes:4,keyboard:true,orbit_pan_zoom:true,reset_preserves_time:true,screenshots:cameraImages};
 // All discrete boundaries including 40 ms native->telemetry latency.
 checks.activations=await page.evaluate(()=>{
   const r=window.p8gReplay,out=[];
   for(const a of r.data.metrics.activations){
     r.seek(a.first_sample_time);const s=r.snapshot();if(s.plan!==a.plan_id)throw Error('activation mismatch');
     const p=r.data.plans.find(p=>p.plan_id===s.plan);
     if(p.plan_start_sim_time!==p.source_simulation_time)throw Error('retimed plan');
     out.push({plan:s.plan,native_time:a.native_time,display_time:s.time,request_time:p.plan_start_sim_time});
   }return out;
 });
 assert.equal(checks.activations.length,7);
 // Warm up optional layers before checking stable GPU allocations over 400 seeks.
 await page.getByText('Layers & diagnostics',{exact:true}).click();
 for(const name of ['Audited three-circle footprint','Recorded activation positions','Old plans ghost (not actual execution)'])await page.getByLabel(name,{exact:true}).check();
 await page.getByRole('button',{name:'TASK_COMPLETE',exact:true}).click();
 const terminalShot=await snap();assert.equal(terminalShot.index,1914);assert.match(await page.locator('#state').innerText(),/TASK_COMPLETE/);
 checks.task_complete=true;
 const warm=await snap();
 const resources=await page.evaluate(()=>{
   const r=window.p8gReplay;
   for(let i=0;i<400;i++)r.seek(r.data.frames[(i*137)%r.data.frames.length].time);
   return r.snapshot().resources;
 });
 assert.deepEqual(resources,warm.resources);checks.no_resource_growth={before:warm.resources,after:resources,seeks:400};
 checks.no_physics=await page.evaluate(()=>{
   const b=window.p8gReplay.view.boat;let stepRejected=false,positiveUpdateRejected=false;
   try{b._step(.02);}catch{stepRejected=true;}
   try{b.update(.02);}catch{positiveUpdateRejected=true;}
   return {stepRejected,positiveUpdateRejected};
 });
 assert.ok(checks.no_physics.stepRejected&&checks.no_physics.positiveUpdateRejected);
 assert.equal(await page.evaluate(()=>window.replayWebSocketAttempts),0);
 assert.ok(requests.every(u=>u.startsWith('http://localhost:8089/')||u.startsWith('blob:http://localhost:8089/')));
 checks.no_live_network=true;
 const datasets=requests.filter(u=>u.includes('/replay-data/'));
 assert.equal(datasets.length,6);assert.equal(new Set(datasets).size,6);checks.dataset_loaded_once=true;
 for(const name of ['Audited three-circle footprint','Recorded activation positions','Old plans ghost (not actual execution)'])await page.getByLabel(name,{exact:true}).uncheck();
 await page.getByText('Layers & diagnostics',{exact:true}).click();
 await page.getByRole('button',{name:'Paper Mode',exact:true}).click();
 checks.png=[];
 for(const name of ['Initial','Avoidance initiation','Before conflict','Closest approach','Conflict passed','TASK_COMPLETE']){
   // Paper mode hides preset buttons; seek through their same recorded preset definitions.
   const time=await page.evaluate(name=>{const r=window.p8gReplay,p=r.data.metrics.presets.find(p=>p.name===name);r.seek(p.time);return p.time;},name);
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('button',{name:'Save PNG',exact:true}).click();const download=await downloadPromise;
   const file=name.replaceAll(' ','_')+'.png';await download.saveAs(path.join(shots,file));
   await fs.unlink(path.join(shots,file)+':Zone.Identifier').catch(()=>{});
   const bytes=await fs.readFile(path.join(shots,file));assert.equal(bytes.subarray(1,4).toString(),'PNG');
   checks.png.push({preset:name,time,file,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 await page.getByRole('button',{name:'Paper Mode',exact:true}).click();
 await page.getByRole('button',{name:'Closest approach',exact:true}).click();
 await page.screenshot({path:path.join(shots,'viewer_CPA.png')});
 assert.deepEqual(errors,[]);
 checks.browser_errors=errors;
 // Fail-closed browser acceptance, independent of the happy-path page.
 const bad=await context.newPage();
 await bad.route('**/replay-data/p8f2-ar10/frames.json',route=>route.fulfill({status:200,body:'[]',contentType:'application/json'}));
 await bad.goto('http://localhost:8089/replay.html');
 await bad.waitForFunction(()=>document.querySelector('#loading')?.textContent.includes('REPLAY_DATA_VALIDATION_FAILED'));
 assert.equal(await bad.evaluate(()=>!!window.p8gReplay),false);
 checks.tampered_data_browser_rejected=true;
 const report={status:'AUTOMATED_BROWSER_CHECKS_PASS_PENDING_IMAGE_REVIEW',browser:await browser.version(),channel:'installed Windows Google Chrome',headless:true,url:'http://localhost:8089/replay.html',windows_localhost_http_status:200,chrome_extension:'unavailable: nodeRepl.fetch request failed; user-authorized Playwright fallback',checks};
 await fs.writeFile(path.join(output,'browser_acceptance.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;process.exit(1);});
