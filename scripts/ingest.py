"""Move the newest MCP tool-result file into raw/<label>.json and print a summary.
Usage: python ingest.py <label> [pattern]"""
import sys,glob,os,json,shutil,collections
D=os.environ.get('MCP_RESULTS_DIR','/root/.claude/projects/-home-claude/e54961d7-2ce8-5ca6-9f61-4e9a72752cb1/tool-results/').rstrip('/')+'/'  # folder where the Claude session saves large MCP results
label=sys.argv[1]; pat=sys.argv[2] if len(sys.argv)>2 else '*'
fs=sorted(glob.glob(D+'mcp-*'+pat+'*.txt'),key=os.path.getmtime)
f=fs[-1]; t=open(f).read(); d=json.loads(t[t.find('{'):])
out=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'raw',label+'.json'); shutil.move(f,out)
r=d.get('result',[]); print(label,'<-',os.path.basename(f),'rows',len(r),d.get('message'),d.get('HTTP'))
if r and 'issue_date' in r[0]:
    ds=[x['issue_date'] for x in r]; print(' dates',min(ds),max(ds),'first',ds[0],'last',ds[-1])
