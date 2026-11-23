"""Puzzle path economy simulator.
A player solves n path puzzles a day. Difficulty comes from the path (a ladder), never from rating;
prompts fade out over the boards; a recovery offset eases difficulty after misses. Every bonus is modelled."""
import math, random, json, sys
import numpy as np

NAMES=["Wood","Stone","Bronze","Silver","Crystal","Elite","Champion","Legend"]

class Rules:
    def __init__(s, **kw):
        s.G=[1,1.25,1.5,1.75,2,2.25,2.5,2.75]            # board factor on every scaled reward
        s.BASE={"E":8,"M":12,"H":16,"X":22}               # base by band (relative to your target)
        s.STREAK_CAP=14                                   # +1×g per clean solve in a row after the first, max 14
        s.PROMPT_BONUS=[0,0,2,4]                          # by prompt level P3,P2,P1,P0 (×g): unprompted pays a little more
        s.DAILY3=60; s.DAILY10=25; s.WEEK=150             # ×g
        s.STREAK_MS={15:50,30:100,50:200,100:300}         # ×g; then every 50 → 300
        s.SOLVED_MS=50; s.SOLVED_MS_1000=250              # ×g
        s.BEST_STREAK=25; s.HARDEST=25; s.HARD50=50       # ×g
        s.HINT_PTS=2
        s.SETTING_MULT=[1,1.3,1.6]                       # Standard / Hard / Extra hard: on base, streak and prompt points
        s.TOTALS=[3000,11000,25000,44000,63000,82000,102000,125000]
        s.RAMP=(0.75,1.25)                                # level cost ramp inside a board
        # difficulty ladder
        s.CLIMB=500; s.CLIMB_K=0.85
        s.MIX_END=[(1,0,0,0),(.3,.7,0,0),(0,.6,.4,0),(0,.2,.6,.2),(0,0,.5,.5),(0,0,.2,.8),(0,0,0,1),(0,0,0,1)]
        s.PROMPT_EFFECT=[220,150,80,0]
        s.BANDS=[("E",-175,.20),("M",0,.65),("H",175,.13),("X",325,.02)]
        # recovery
        s.REC_DOWN=25; s.REC_UP=12; s.REC_FLOOR=-400; s.REC_PROMPT=(-150,-300)
        s.__dict__.update(kw)
    def costs(s):
        out=[]
        for b,T in enumerate(s.TOTALS):
            a,z=s.RAMP;raw=[T/20*(a+(z-a)*l/19) for l in range(20)];c=[int(round(x/5)*5) for x in raw];c[-1]+=T-sum(c);out.append(c)
        return out

def mix_at(R,b,l):
    start=R.MIX_END[b-1] if b>0 else R.MIX_END[0];end=R.MIX_END[b];t=l/19
    return [start[i]+(end[i]-start[i])*t for i in range(4)]

def simulate(R,n_per_day,S0=1000,G=450,tau=500,days=2200,seed=1,setting=0,daily_var=True,stop_at_max=True,record=False):
    rng=random.Random(seed);C=R.costs();cum=[];acc=0
    for b in range(8):
        for l in range(20):cum.append(acc);acc+=C[b][l]
    TOTAL=acc;R0=min(1100,max(500,S0-350))
    pts=0;streak=0;best=0;solved=0;hard=0;hardest=-1e9;delta=0;consec=0;weekrun=0
    lvl_day=[None]*161;lvl_day[0]=0;board_day=[None]*9;board_day[0]=0
    stats=dict(attempts=0,clean=0,hints=0,fails=0,rec_attempts=0,moments={"daily3":0,"daily10":0,"week":0,"streak":0,"solved":0},
               income={"base":0,"speed":0,"streak":0,"prompt":0,"daily":0,"moments_other":0,"chips":0,"hint":0})
    per_board_p=[[0,0] for _ in range(8)];per_board_pts=[[0,0] for _ in range(8)]
    def level_of(p):
        i=np.searchsorted(cum,p,side="right")-1;return min(int(i),159)
    for d in range(days):
        n=n_per_day if not daily_var else max(1,int(round(rng.gauss(n_per_day,1.2))))
        clean_today=0;ds=False
        S=S0+G*(1-math.exp(-d/tau))
        for k in range(n):
            L=level_of(pts);b,l=divmod(L,20);g=R.G[b]
            T=R0+R.CLIMB*(L/159)**R.CLIMB_K+[0,150,300][setting]+delta
            mix=mix_at(R,b,l);pr=rng.choices([0,1,2,3],weights=mix)[0]
            if delta<=R.REC_PROMPT[1]:pr=max(0,pr-2)
            elif delta<=R.REC_PROMPT[0]:pr=max(0,pr-1)
            bands=R.BANDS if setting==0 else ([("E",-175,.10),("M",0,.55),("H",175,.27),("X",325,.08)] if setting==1 else [("E",-175,.05),("M",0,.40),("H",175,.38),("X",325,.17)])
            band,off,_=rng.choices(bands,weights=[x[2] for x in bands])[0]
            Rp=T+off+rng.gauss(0,40)
            p=1/(1+10**((Rp-(S+R.PROMPT_EFFECT[pr]))/400))
            stats["attempts"]+=1;per_board_p[b][1]+=1
            if delta<=-100:stats["rec_attempts"]+=1
            before=pts;u=rng.random()
            if u<p:  # clean
                streak+=1;solved+=1;clean_today+=1;stats["clean"]+=1;per_board_p[b][0]+=1;consec=0
                sm=R.SETTING_MULT[setting];base=round(R.BASE[band]*g*sm);q=min(1,max(0,p**1.6+rng.gauss(0,.12)));sp=max(1,min(7,int(round(1+6*q))))
                st=round(min(streak-1,R.STREAK_CAP)*g*sm);pb=round(R.PROMPT_BONUS[pr]*g*sm)
                pts+=base+sp+st+pb;stats["income"]["base"]+=base;stats["income"]["speed"]+=sp;stats["income"]["streak"]+=st;stats["income"]["prompt"]+=pb
                if streak>best and streak>=5:pts+=round(R.BEST_STREAK*g);stats["income"]["chips"]+=round(R.BEST_STREAK*g)
                best=max(best,streak)
                if solved>20 and Rp>hardest+50:pts+=round(R.HARDEST*g);stats["income"]["chips"]+=round(R.HARDEST*g)
                hardest=max(hardest,Rp)
                if band in "HX":
                    hard+=1
                    if hard%50==0:pts+=round(R.HARD50*g);stats["income"]["chips"]+=round(R.HARD50*g)
                if clean_today==3:
                    v=round(R.DAILY3*g);pts+=v;stats["income"]["daily"]+=v;stats["moments"]["daily3"]+=1;ds=True
                    weekrun+=1
                    if weekrun==7:v=round(R.WEEK*g);pts+=v;stats["income"]["daily"]+=v;stats["moments"]["week"]+=1;weekrun=0
                if clean_today==10:v=round(R.DAILY10*g);pts+=v;stats["income"]["daily"]+=v;stats["moments"]["daily10"]+=1
                if streak in R.STREAK_MS or (streak>100 and streak%50==0):v=round(R.STREAK_MS.get(streak,300)*g);pts+=v;stats["income"]["moments_other"]+=v;stats["moments"]["streak"]+=1
                if solved%100==0:v=round((R.SOLVED_MS_1000 if solved%1000==0 else R.SOLVED_MS)*g);pts+=v;stats["income"]["moments_other"]+=v;stats["moments"]["solved"]+=1
                if delta<0:delta=min(0,delta+R.REC_UP)
            elif u<p+(1-p)*.2:  # solved with a hint
                stats["hints"]+=1;pts+=R.HINT_PTS;stats["income"]["hint"]+=R.HINT_PTS
            else:  # miss
                stats["fails"]+=1;streak=0;consec+=1
                delta=max(R.REC_FLOOR,delta-R.REC_DOWN*min(consec,4))
            per_board_pts[b][0]+=pts-before;per_board_pts[b][1]+=1
            L2=level_of(pts)
            for x in range(L+1,L2+1):
                if lvl_day[x] is None:lvl_day[x]=d+ (k+1)/n
            b2=L2//20
            for x in range(b+1,b2+1):
                if board_day[x] is None:board_day[x]=d+(k+1)/n
            if pts>=TOTAL:
                lvl_day[160]=d+(k+1)/n;board_day[8]=d+(k+1)/n
                if stop_at_max:break
        if not ds:weekrun=0
        if stop_at_max and pts>=TOTAL:break
    stats["p_board"]=[round(a/b_,3) if b_ else None for a,b_ in per_board_p]
    stats["ppp_board"]=[round(a/b_,1) if b_ else None for a,b_ in per_board_pts]
    return dict(lvl_day=lvl_day,board_day=board_day,stats=stats,total=TOTAL,final_delta=delta)

def avg_run(R,n,seeds=6,**kw):
    runs=[simulate(R,n,seed=s,**kw) for s in range(seeds)]
    bd=[np.mean([r["board_day"][i] for r in runs if r["board_day"][i] is not None]) if all(r["board_day"][i] is not None for r in runs) else None for i in range(9)]
    ld=[np.mean([r["lvl_day"][i] for r in runs]) if all(r["lvl_day"][i] is not None for r in runs) else None for i in range(161)]
    return dict(board_day=bd,lvl_day=ld,runs=runs)


if __name__=="__main__":
    """python3 docs/path-economy-sim.py  → pacing for light / typical / heavy players and a few skill profiles.
    Change a constant in Rules (or pass Rules(TOTALS=[...]) etc.) and re-run before changing the app's numbers."""
    R=Rules()
    for name,n,kw in [("5 a day",5,{}),("7.5 a day",7.5,{}),("10 a day",10,{}),("7.5, weak improver",7.5,dict(S0=800,G=300)),("7.5, never improves",7.5,dict(S0=1000,G=0)),("7.5, strong",7.5,dict(S0=1500,G=300))]:
        r=avg_run(R,n,seeds=6,**kw);bd=r["board_day"]
        A=sum(x["stats"]["attempts"] for x in r["runs"]);Cl=sum(x["stats"]["clean"] for x in r["runs"])
        print(f"{name:20s} Legend 20 after {bd[8]/365:.2f} years · {Cl/A:.0%} clean · board starts (day) {[int(round(v)) for v in bd[1:]]}")
