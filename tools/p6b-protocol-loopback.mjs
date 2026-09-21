// Protocol-only manufactured plant. NOT an E1/E2 or 6DOF tracking acceptance.
import fs from 'node:fs';import { spawn } from 'node:child_process';import { tmpdir } from 'node:os';import WebSocket from 'ws';
import { createVesselState } from '../site/js/twin/vessel-state.js';import { CommandMux } from '../site/js/control/command-authority.js';import { PlannerBridge } from '../site/js/bridge/planner-bridge.js';
import { SimulationHoldController,PlanExecutionController,plantCapabilities } from '../site/js/integration/plan-execution.js';import { VESSEL_SPECS } from '../site/js/simulation/vessels.js';
const child=spawn('wsl.exe',['-d','Ubuntu-22.04','-u','zy','--','env','LD_LIBRARY_PATH=/home/zy/.local/casadi-3.8.1-gcc/lib','OPENBLAS_NUM_THREADS=1','OMP_NUM_THREADS=1','/home/zy/work/all-in-planner/build/p5b-linux/cpp/lifted_stp/openwater/p6b_openwater_server','8772','/home/zy/work/all-in-planner/research/lifted_stp/results/p6b_c1/protocol-mock','/home/zy/work/all-in-planner/cpp/lifted_stp/openwater/execution/config/protocol-mock.json'],{cwd:tmpdir()});
let output='',timer,execution,bridge;child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
const pause=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn,seconds=90){let t=performance.now();while(!fn()){if(performance.now()-t>1000*seconds)throw Error(`Timeout ${execution?.status} ${output.slice(-400)}`);await pause(5);}}
try{
 await until(()=>output.includes('P6B LISTEN'),30);
 const state=createVesselState();state.timestamp=5;state.velocity.body.surge=2;state.actuator.rawThrustN=82;state.actuator.effectiveThrustN=80;state.actuator.propulsionActual=82/10500;state.control.propulsionCommand=82/10500;
 const commands=[],modes=[];const mux=new CommandMux({setActuatorCommands:c=>commands.push({...c})},{maxSteerRad:Math.PI/6});const original=mux.setMode.bind(mux);mux.setMode=m=>{modes.push(m);original(m);};
 const hold=new SimulationHoldController();hold.hold();let sequence=0;
 bridge=new PlannerBridge(mux,{endpoint:'ws://127.0.0.1:8772',socketFactory:url=>new WebSocket(url),obstacleSource:time=>({protocol_version:1,type:'obstacle_state',sequence:sequence++,simulation_time:time,obstacles:[]}),onPlan:p=>execution.onPlan(p)});
 execution=new PlanExecutionController(bridge,mux,hold,plantCapabilities(VESSEL_SPECS.zodiac_boat));bridge.execution=execution;bridge.start();timer=setInterval(()=>{if(hold.held||!bridge.diagnostics.connected)bridge.update(state);},20);
 await until(()=>bridge.diagnostics.connected,15);execution.request(state,'E1');await until(()=>execution.status==='PLAN_READY'||execution.status==='SOLVER_ERROR');if(execution.status!=='PLAN_READY')throw Error('Mock solve failed');
 execution.execute();await until(()=>execution.status==='EXECUTING');
 const source=state.timestamp;
 while(execution.status==='EXECUTING'){
  state.timestamp+=.02;state.sequence++;state.pose.position.y=2*(state.timestamp-source);bridge.nextPublish=-Infinity;bridge.update(state);
  await until(()=>execution.status!=='EXECUTING'||execution.metrics.t_rel>=state.timestamp-source-1e-9,5);execution.update(state);
 }
 if(execution.status!=='COMPLETE'||mux.mode!=='MANUAL'||execution.failures)throw Error('Mock execution did not complete safely');
 fs.mkdirSync('results/p6b_c1',{recursive:true});fs.writeFileSync('results/p6b_c1/protocol-loopback.json',JSON.stringify({status:'PASS',scope:'manufactured protocol plant only; not 6DOF acceptance',commands:commands.length,events:execution.events,modes,plan_points:execution.plan.points.length,timeout_count:execution.failures,simulation_time:state.timestamp,final_mode:mux.mode},null,2));console.log('PASS native protocol execution',commands.length,modes);
}catch(e){console.error(e);process.exitCode=1;}finally{clearInterval(timer);bridge?.stop();child.stdin.end('QUIT\n');}