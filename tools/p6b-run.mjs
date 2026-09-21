// Local, obstacle-free execution diagnostic through native WS -> real bridge/mux -> frozen Boat.
import fs from 'node:fs';import { spawn } from 'node:child_process';import { tmpdir } from 'node:os';import WebSocket from 'ws';import * as THREE from 'three';
import { WaveField } from '../site/js/simulation/waves.js';import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
import { SimulationStateSource } from '../site/js/twin/simulation-state-source.js';import { CommandMux } from '../site/js/control/command-authority.js';import { PlannerBridge } from '../site/js/bridge/planner-bridge.js';
import { plantCapabilities,SimulationHoldController,PlanExecutionController,P6BTestPreconditioner } from '../site/js/integration/plan-execution.js';
globalThis.window??={location:{search:''}};globalThis.matchMedia??=()=>({matches:false});const { Boat }=await import('../site/js/simulation/boat.js');
const name=process.argv[2]??'feedforward',scenario=process.argv[3]??'CALIBRATION';
const root='\\\\wsl.localhost\\Ubuntu-22.04\\home\\zy\\work\\all-in-planner';
const directory=`/home/zy/work/all-in-planner/research/lifted_stp/results/p6b_c1/${name}`;
const config=`/home/zy/work/all-in-planner/cpp/lifted_stp/openwater/execution/config/${name}.json`;
const child=spawn('wsl.exe',['-d','Ubuntu-22.04','-u','zy','--','env','LD_LIBRARY_PATH=/home/zy/.local/casadi-3.8.1-gcc/lib','OPENBLAS_NUM_THREADS=1','OMP_NUM_THREADS=1','/home/zy/work/all-in-planner/build/p5b-linux/cpp/lifted_stp/openwater/p6b_openwater_server','8770',directory,config],{cwd:tmpdir()});
let output='',timer;child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,seconds=60){const start=performance.now();while(!fn()){if(performance.now()-start>seconds*1000)throw Error(`Timeout ${execution?.status}: ${output.slice(-800)}`);await pause(5);}}
let execution,bridge;
try{
 await until(()=>output.includes('P6B LISTEN'),30);
 const water=new WaveField();water.setSeaPreset(1);const boat=new Boat(water,new THREE.Scene(),0);boat.setSpec(VESSEL_SPECS.zodiac_boat);boat.reset();
 const source=new SimulationStateSource(boat,water);source.update();const mux=new CommandMux(boat,{maxSteerRad:boat.spec.maxSteerRad});const hold=new SimulationHoldController();
 let obstacleSeq=0;
 bridge=new PlannerBridge(mux,{endpoint:'ws://127.0.0.1:8770',socketFactory:url=>new WebSocket(url),visualizationOnly:false,obstacleSource:time=>({protocol_version:1,type:'obstacle_state',sequence:obstacleSeq++,simulation_time:time,obstacles:[]}),onPlan:m=>execution.onPlan(m)});
 execution=new PlanExecutionController(bridge,mux,hold,plantCapabilities(boat.spec));bridge.execution=execution;
 const pre=new P6BTestPreconditioner(mux,boat.spec,hold);pre.start();
 while(pre.active){pre.update(source.getState(),.02);mux.apply(performance.now()/1000);const dt=hold.timestep(.02);water.update(dt,boat.pos.x,boat.pos.z);boat.update(dt);source.update();}
 const initial=source.snapshot();console.log(name,'precondition',pre.status,initial.timestamp,initial.velocity.body.surge,initial.actuator.rawThrustN);
 if(pre.status!=='READY')throw Error('Preconditioning failed');
 bridge.start();timer=setInterval(()=>{if(hold.held||!bridge.diagnostics.connected)bridge.update(source.getState());},20);
 await until(()=>bridge.diagnostics.connected,15);await pause(50);
 execution.request(source.getState(),scenario);
 await until(()=>['PLAN_READY','SOLVER_ERROR','ABORTED'].includes(execution.status),180);
 if(execution.status!=='PLAN_READY')throw Error(JSON.stringify(execution.events));
 execution.execute();await until(()=>execution.status==='EXECUTING'||execution.status==='ABORTED',10);
 while(execution.status==='EXECUTING'){
  mux.apply(performance.now()/1000);water.update(.02,boat.pos.x,boat.pos.z);boat.update(.02);source.update();
  bridge.nextPublish=-Infinity;bridge.update(source.getState());
  await until(()=>execution.status!=='EXECUTING'||execution.metrics.t_rel>=water.time-execution.plan.source_simulation_time-1e-9,5);
  execution.update(source.getState());
 }
 const nativePath=`${root}\\research\\lifted_stp\\results\\p6b_c1\\${name}\\execution-1.jsonl`;
 const records=fs.readFileSync(nativePath,'utf8').trim().split('\n').map(x=>JSON.parse(x));
 const rms=k=>Math.sqrt(records.reduce((s,r)=>s+r[k]**2,0)/records.length),max=k=>Math.max(...records.map(r=>Math.abs(r[k])));
 const report={name,scenario,status:execution.status,initial,final:source.snapshot(),plan:execution.plan,events:execution.events,controller_config:JSON.parse(fs.readFileSync(`${root}\\cpp\\lifted_stp\\openwater\\execution\\config\\${name}.json`,'utf8')),metrics:{max_position:max('position_error'),rms_position:rms('position_error'),max_heading:max('heading_error'),rms_cross:rms('cross_error'),max_cross:max('cross_error'),rms_speed:rms('speed_error'),max_speed:max('speed_error'),rms_yaw:rms('yaw_error'),terminal_position:records.at(-1).position_error,saturation_fraction:records.filter(r=>r.amplitude_saturated).length/records.length,rate_limited_fraction:records.filter(r=>r.rate_limited).length/records.length,timeouts:execution.failures},terminal:records.at(-1),messages:bridge.diagnostics};
 fs.mkdirSync('results/p6b_c1',{recursive:true});fs.writeFileSync(`results/p6b_c1/${name}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.metrics));
}catch(e){console.error(e);process.exitCode=1;}finally{clearInterval(timer);bridge?.stop();child.stdin.end('QUIT\n');}