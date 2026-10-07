import argparse,hashlib,json,os,re,subprocess,tempfile
from pathlib import Path
from lifecycle import verify_release
B=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def run(release,evidence):
 release=Path(release).resolve(); evidence=Path(evidence).resolve(); evidence.mkdir(parents=True,exist_ok=True); manifest=verify_release(release)
 node=str(release/manifest['node']['path']); cli=str(release/manifest['cli']); records=[]
 for p in (release/'cli').rglob('*'):
  if p.suffix in ['.js','.mjs']:subprocess.run([node,'--check',str(p)],check=True,capture_output=True)
 with tempfile.TemporaryDirectory(dir=evidence) as temporary:
  work=Path(temporary); home=work/'home'; (home/'.caveman-cloud').mkdir(parents=True)
  (home/'.caveman-cloud/config.json').write_text(json.dumps(dict(telemetry={'enabled':False},remember={'mem':False,'offload':'off','recall':False},think={'mode':'compress','core':True,'shrink':False},execute={'proxy':False,'mcp':False},learnAutopilot=False)))
  env=dict(os.environ,USERPROFILE=str(home),HOME=str(home),CODEX_HOME=str(home/'.codex'),CAVEMAN_HOME=str(home/'.caveman'),CAVEMAN_CCR_DB=str(home/'ccr.db'),PATH='',CAVEMAN_TELEMETRY='0',DO_NOT_TRACK='1',CAVEMAN_LEARN_AUTOPILOT='off',CAVE_PIXEL_MODELS='off')
  assert subprocess.run([node,'-e','process.stdout.write(require("node:os").homedir())'],env=env,capture_output=True,check=True).stdout.decode()==str(home)
  def call(args,**extra):return subprocess.run([node,cli,*args],env=env,cwd=work,capture_output=True,timeout=30,**extra)
  help_result=call(['--help']);assert help_result.returncode==0;records.append(dict(case='no-PATH help',exit=0))
  for args in [['update'],['setup','--install'],['enable','codex'],['disable','codex'],['mcp','install','codex'],['hooks','install','codex'],['skills','add','fixture'],['doctor','codex','--fix'],['wrap','codex']]:
   result=call(args);assert result.returncode!=0 and b'Maintained release blocks' in result.stderr,(args,result.stderr);records.append(dict(case='dispatch '+ ' '.join(args),exit=result.returncode))
  # Resolver ignores hostile inherited locations. Fixture release lacks binary and must fail without PATH fallback.
  fixture=work/'fixture'; (fixture/'cli/dist').mkdir(parents=True); (fixture/'bin').mkdir(); fake=fixture/'bin/caveman-engine.exe';fake.write_bytes(b'fixture')
  module=fixture/'cli/dist/maintained-release.mjs';module.write_bytes((release/'cli/dist/maintained-release.mjs').read_bytes());(fixture/'release-manifest.json').write_text(json.dumps(dict(environment={},node={'path':'node/node.exe'},binaries={'caveman-engine':{'path':'bin/caveman-engine.exe','env':'CAVEMAN_ENGINE_BIN'}})))
  code='import {maintainedBinary} from '+json.dumps(module.as_uri())+';process.stdout.write(maintainedBinary("caveman-engine"))'
  hostile=dict(env,CAVEMAN_ENGINE_BIN='C:/unowned/evil.exe'); result=subprocess.run([node,'--input-type=module','-e',code],env=hostile,capture_output=True);assert result.returncode==0 and result.stdout.decode()==str(fake)
  fake.unlink();result=subprocess.run([node,'--input-type=module','-e',code],env=hostile,capture_output=True);assert result.returncode!=0;records.append(dict(case='hostile override ignored and missing binary fails',exit=result.returncode))
  payload=('fixture repeated detail line with exact recovery content\n'*150+'FINAL fixture tail\n').encode();log=work/'noisy.log';log.write_bytes(payload);script=work/'noisy.cjs';script.write_text('process.stdout.write('+json.dumps(payload.decode())+');process.exit(7);')
  for args,expected,label in [(['shrink','--',node,str(script)],7,'finite command'),(['shrink','--file',str(log)],0,'saved file')]:
   result=call(args);assert result.returncode==expected,(label,result.returncode,result.stderr);(evidence/(label.replace(' ','-')+'.stdout')).write_bytes(result.stdout);(evidence/(label.replace(' ','-')+'.stderr')).write_bytes(result.stderr)
   match=re.search(rb'caveman retrieve\s+([A-Za-z0-9:_-]+)',result.stdout);assert match,('No recovery handle',result.stdout[-700:],result.stderr)
   handle=match.group(1).decode();recovery=call(['retrieve',handle]);assert recovery.returncode==0 and recovery.stdout==payload,(label,handle,recovery.stderr)
   (evidence/(label.replace(' ','-')+'.recovered')).write_bytes(recovery.stdout);records.append(dict(case=label,status=result.returncode,handle=handle,recovery_exit=recovery.returncode,full_unqueried_bytes=len(recovery.stdout),sha256=sha(recovery.stdout)))
  pwsh=Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';assert pwsh.is_file()
  projection='import {NATIVE_CORE,NATIVE_SKILL_INSTRUCTIONS} from '+json.dumps((release/'cli/dist/native-pack.generated.js').as_uri())+';process.stdout.write(JSON.stringify({core:NATIVE_CORE,lean:NATIVE_SKILL_INSTRUCTIONS["lean-build"]}));'
  native=json.loads(subprocess.run([node,'--input-type=module','-e',projection],env=env,capture_output=True,check=True).stdout)
  voice=(B/'skills/caveman/SKILL.md').read_text('utf-8').split('# caveman\n',1)[1].split('## Persistence',1)[0].strip()
  for event in ['SessionStart','SubagentStart','PostCompact']:
   for profile,core,mode,expected in [('full-safe','on','compress',True),('core-lean-build','on','compress',True),('full-safe','off','compress',False),('record-only','on','record',False)]:
    childenv=dict(env,CAVEMAN_NATIVE_PROFILE=profile,CAVEMAN_CORE=core,CAVEMAN_WRAP_MODE=mode,CAVEMAN_NATIVE_MODE='record' if mode=='record' else 'safe')
    payload=json.dumps(dict(hook_event_name=event,session_id='maintained-proof',parent_session_id='fixture-parent',agent_id='fixture-child',cwd=str(work),source='startup')).encode()
    result=subprocess.run([str(pwsh),'-NoProfile','-NonInteractive','-File',str(release/'native-hook.ps1')],env=childenv,cwd=work,input=payload,capture_output=True,timeout=15)
    assert result.returncode==0,(event,profile,result.stderr);out=json.loads(result.stdout) if result.stdout.strip() else {};context=out.get('hookSpecificOutput',{}).get('additionalContext','');assert bool(context)==expected,(event,profile,core,out)
    if expected:assert context==native['core']+(' '+native['lean'] if profile=='core-lean-build' else '')+'\n'+voice,(event,profile,context[-300:])
    records.append(dict(case='exact Core hook output',event=event,profile=profile,core=core,mode=mode,exit=result.returncode,context_sha256=sha(context.encode()),context=context))
 verify_release(release);(evidence/'proof.json').write_text(json.dumps(dict(status='CONTROLLED_PASS',records=records,desktop_delivery='UNKNOWN',active_backend_identity='UNKNOWN'),indent=2)+'\n','utf-8');print('PASS syntax, closure, dispatch, no-PATH, missing binary, nonzero Shrink/full recovery, saved-file status and 12 Core hook cases')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--release',required=True);p.add_argument('--evidence',required=True);a=p.parse_args();run(a.release,a.evidence)
