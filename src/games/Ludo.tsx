import React,{useEffect,useRef,useState}from"react";
import{View,Text,TouchableOpacity,StyleSheet,Animated,Dimensions,Vibration}from"react-native";
import{useNavigation}from"@react-navigation/native";
import{GameDoc,updateGame}from"./gameService";
import{GameResultModal}from"./GameResultModal";

const{width}=Dimensions.get("window");
const BOARD=Math.min(width-8,360);
const N=15;
const C=Math.round(BOARD/N);
const BW=3;

const ROUGE="#D42020";const ROUGE_I="#FFCCCC";const ROUGE_S="#F09898";
const BLEU="#1A50CC"; const BLEU_I="#C4D8FF"; const BLEU_S="#90B4F8";
const VERT="#1A901A"; const VERT_I="#BBEEBB"; const VERT_S="#80D080";
const JAUNE="#C89000";const JAUNE_I="#FFF4CC";const JAUNE_S="#FFD840";
const P1C=ROUGE;const P2C=BLEU;

const PATH:[number,number][]=[
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const PL=52;
const P2_OFF=13;
const P1_STR:[number,number][]=[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7]];
const P2_STR:[number,number][]=[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7],[7,7]];
const WIN_POS=PL+P1_STR.length-1;
const SAFE_IDX=new Set([0,13,21,47]);

// ✅ Étoiles corrigées selon tes instructions
const SAFE_STARS=new Map<string,string>([
  ["3,6",BLEU_S],   // Bleu  — décalé à gauche
  ["8,3",ROUGE_S],  // Rouge — descendu d'une case
  ["6,11",JAUNE_S], // Jaune — monté d'une case
  ["11,8",VERT_S],  // Vert  — décalé à droite
]);

const P_INSET=Math.round(C*0.42);
const P_SIZE=Math.round(6*C-2*P_INSET);
const P_PAD=Math.round(C*0.13);
const P_GAP=Math.round(C*0.13);
const P_BOX=Math.round((P_SIZE-P_PAD*2-P_GAP)/2);
const P_RAD=Math.round(C*0.65);
const PC1=Math.round(P_INSET+P_PAD+P_BOX/2);
const PC2=Math.round(P_INSET+P_PAD+P_BOX+P_GAP+P_BOX/2);
const HC=Math.round(1.5*C);
const TR=Math.round(C*0.39);

const P1_HOME:[number,number][]=[
  [PC1,PC1],[PC2,PC1],[PC1,PC2],[PC2,PC2],
];
const P2_HOME:[number,number][]=[
  [9*C+PC1,PC1],[9*C+PC2,PC1],[9*C+PC1,PC2],[9*C+PC2,PC2],
];

type Cell={bg:string;type:string};
const GRID:Cell[][]=(()=>{
  const g:Cell[][]=Array(N).fill(null).map(()=>
    Array(N).fill(null).map(()=>({bg:"#FAFAFA",type:"path"})));
  for(let r=0;r<6;r++)for(let c=0;c<6;c++)     g[r][c]={bg:ROUGE,type:"h_r"};
  for(let r=0;r<6;r++)for(let c=9;c<N;c++)     g[r][c]={bg:BLEU, type:"h_b"};
  for(let r=9;r<N;r++)for(let c=0;c<6;c++)     g[r][c]={bg:VERT, type:"h_v"};
  for(let r=9;r<N;r++)for(let c=9;c<N;c++)     g[r][c]={bg:JAUNE,type:"h_j"};
  for(let r=1;r<5;r++)for(let c=1;c<5;c++)     g[r][c]={bg:ROUGE_I,type:"i_r"};
  for(let r=1;r<5;r++)for(let c=10;c<14;c++)   g[r][c]={bg:BLEU_I, type:"i_b"};
  for(let r=10;r<14;r++)for(let c=1;c<5;c++)   g[r][c]={bg:VERT_I, type:"i_v"};
  for(let r=10;r<14;r++)for(let c=10;c<14;c++) g[r][c]={bg:JAUNE_I,type:"i_j"};
  for(let c=1;c<=6;c++) g[7][c]={bg:ROUGE_S,type:"s_r"};
  for(let r=1;r<=6;r++) g[r][7]={bg:BLEU_S, type:"s_b"};
  for(let c=8;c<=13;c++)g[7][c]={bg:JAUNE_S,type:"s_j"};
  for(let r=8;r<=13;r++)g[r][7]={bg:VERT_S, type:"s_v"};
  for(let r=6;r<=8;r++)for(let c=6;c<=8;c++) g[r][c]={bg:"#fff",type:"ctr"};
  g[6][1]={bg:ROUGE_I,type:"dp1"};
  g[1][8]={bg:BLEU_I, type:"dp2"};
  g[8][13]={bg:VERT_I, type:"dp3"};
  g[13][6]={bg:JAUNE_I,type:"dp4"};
  return g;
})();

function coord(pos:number,isP1:boolean,ti:number):{x:number;y:number}{
  if(pos===-1){const[px,py]=(isP1?P1_HOME:P2_HOME)[ti];return{x:px,y:py};}
  if(pos>=PL){
    const si=pos-PL;const str=isP1?P1_STR:P2_STR;
    const[r,c]=si<str.length?str[si]:[7,7];
    return{x:Math.round(c*C+C/2),y:Math.round(r*C+C/2)};
  }
  const idx=isP1?pos%PL:(pos+P2_OFF)%PL;
  const[r,c]=PATH[idx];
  return{x:Math.round(c*C+C/2),y:Math.round(r*C+C/2)};
}
function pIdx(pos:number,isP1:boolean):number{
  if(pos<0||pos>=PL)return -1;
  return isP1?pos%PL:(pos+P2_OFF)%PL;
}

const FACES=["⚀","⚁","⚂","⚃","⚄","⚅"];
interface Props{game:GameDoc;chatId:string;myId:string;}

const Tok=({color,sz,gold=false}:{color:string;sz:number;gold?:boolean})=>(
  <View style={{
    width:sz,height:sz,borderRadius:Math.round(sz/2),
    backgroundColor:color,overflow:"hidden",
    borderWidth:2,borderColor:"rgba(255,255,255,0.80)",
    shadowColor:gold?"#FFD700":"#000",
    shadowOpacity:gold?1:0.5,shadowRadius:gold?14:6,
    elevation:gold?14:7,
  }}>
    <View style={{
      position:"absolute",left:"8%",top:"6%",
      width:"55%",height:"42%",borderRadius:200,
      backgroundColor:"rgba(255,255,255,0.72)",
    }}/>
    <View style={{
      position:"absolute",right:"5%",bottom:"5%",
      width:"48%",height:"38%",borderRadius:200,
      backgroundColor:"rgba(0,0,0,0.20)",
    }}/>
  </View>
);

const DecPocket=({color,inner}:{color:string;inner:string})=>(
  <View style={{
    position:"absolute",left:P_INSET,top:P_INSET,
    width:P_SIZE,height:P_SIZE,
    backgroundColor:inner,borderRadius:P_RAD,
  }}>
    {[0,1,2,3].map(i=>(
      <View key={i} style={{
        position:"absolute",
        left:i%2===0?P_PAD:P_PAD+P_BOX+P_GAP,
        top:i<2?P_PAD:P_PAD+P_BOX+P_GAP,
        width:P_BOX,height:P_BOX,
        borderRadius:Math.round(P_BOX/2),
        backgroundColor:color,overflow:"hidden",
        borderWidth:2,borderColor:"rgba(255,255,255,0.70)",
        shadowColor:"#000",shadowOpacity:0.28,shadowRadius:5,elevation:5,
      }}>
        <View style={{
          position:"absolute",left:"8%",top:"6%",
          width:"55%",height:"42%",borderRadius:200,
          backgroundColor:"rgba(255,255,255,0.68)",
        }}/>
        <View style={{
          position:"absolute",right:"5%",bottom:"5%",
          width:"48%",height:"38%",borderRadius:200,
          backgroundColor:"rgba(0,0,0,0.16)",
        }}/>
      </View>
    ))}
  </View>
);

export function Ludo({game,chatId,myId}:Props){
  const navigation=useNavigation();
  const board=game.board;
  const isP1=myId===game.player1;
  const myTK=isP1?"p1Tokens":"p2Tokens";
  const enTK=isP1?"p2Tokens":"p1Tokens";
  const myT:number[]=board[myTK]||[-1,-1,-1,-1];
  const enT:number[]=board[enTK]||[-1,-1,-1,-1];
  const isMyTurn=game.currentTurn===myId;
  const finished=game.status==="finished";
  const dice:number=board.dice||0;
  const rolled:boolean=board.diceRolled||false;
  const[rolling,setRolling]=useState(false);
  const[banner,setBanner]=useState<string|null>(null);
  const dScale=useRef(new Animated.Value(1)).current;
  const dRot=useRef(new Animated.Value(0)).current;
  const banAnim=useRef(new Animated.Value(0)).current;
  const tAnims=useRef([0,1,2,3].map(i=>{
    const[px,py]=(isP1?P1_HOME:P2_HOME)[i];
    return{cx:new Animated.Value(px),cy:new Animated.Value(py),s:new Animated.Value(1)};
  })).current;

  useEffect(()=>{
    const tokens:number[]=game.board[myTK]||[-1,-1,-1,-1];
    tokens.forEach((pos,i)=>{
      const c=coord(pos,isP1,i);
      tAnims[i].cx.setValue(c.x);
      tAnims[i].cy.setValue(c.y);
    });
  },[game.board]);

  function showBanner(txt:string){
    setBanner(txt);banAnim.setValue(0);
    Animated.sequence([
      Animated.spring(banAnim,{toValue:1,useNativeDriver:true,speed:20,bounciness:14}),
      Animated.delay(1100),
      Animated.timing(banAnim,{toValue:0,duration:280,useNativeDriver:true}),
    ]).start(()=>setBanner(null));
  }

  async function roll(){
    if(!isMyTurn||rolled||finished||rolling)return;
    setRolling(true);Vibration.vibrate(20);
    Animated.sequence([
      Animated.timing(dScale,{toValue:1.6,duration:100,useNativeDriver:true}),
      Animated.spring(dScale,{toValue:1,useNativeDriver:true,speed:20,bounciness:16}),
    ]).start();
    Animated.loop(
      Animated.timing(dRot,{toValue:1,duration:90,useNativeDriver:true}),
      {iterations:5}
    ).start(()=>dRot.setValue(0));
    await new Promise(r=>setTimeout(r,520));
    const d=Math.floor(Math.random()*6)+1;
    setRolling(false);
    const tokens:number[]=game.board[myTK]||[-1,-1,-1,-1];
    const canMove=tokens.some(p=>{
      if(p===WIN_POS)return false;
      if(p===-1)return d===6;
      return p+d<=WIN_POS;
    });
    try{
      await updateGame(chatId,game.id,{
        board:{...board,dice:d,diceRolled:true},currentTurn:myId,
      });
      if(!canMove){
        await new Promise(r=>setTimeout(r,800));
        const next=game.currentTurn===game.player1?game.player2:game.player1;
        await updateGame(chatId,game.id,{
          board:{...board,dice:d,diceRolled:false},currentTurn:next,
        });
      }
    }catch(e){console.error("roll:",e);setRolling(false);}
  }

  async function move(ti:number){
    if(!isMyTurn||!rolled||finished)return;
    const pos=myT[ti];
    if(pos===WIN_POS||(pos===-1&&dice!==6)||(pos>=0&&pos+dice>WIN_POS))return;
    const newPos=pos===-1?0:pos+dice;
    const c=coord(newPos,isP1,ti);
    Animated.sequence([
      Animated.timing(tAnims[ti].s,{toValue:1.7,duration:120,useNativeDriver:false}),
      Animated.parallel([
        Animated.spring(tAnims[ti].cx,{toValue:c.x,useNativeDriver:false,speed:14,bounciness:10}),
        Animated.spring(tAnims[ti].cy,{toValue:c.y,useNativeDriver:false,speed:14,bounciness:10}),
      ]),
      Animated.timing(tAnims[ti].s,{toValue:1,duration:100,useNativeDriver:false}),
    ]).start();
    Vibration.vibrate(15);
    const newEn=[...enT];
    if(newPos<PL){
      const mi=pIdx(newPos,isP1);
      enT.forEach((ep,ei)=>{
        if(ep<0||ep>=PL)return;
        if(pIdx(ep,!isP1)===mi&&!SAFE_IDX.has(mi)){
          newEn[ei]=-1;showBanner("💥 Éliminé !");Vibration.vibrate([0,60,60,60]);
        }
      });
    }
    const newMy=[...myT];newMy[ti]=newPos;
    const won=newMy.every(p=>p===WIN_POS);
    const extra=dice===6&&!won;
    const next=extra?myId:(game.currentTurn===game.player1?game.player2:game.player1);
    if(dice===6&&!won)showBanner("🎲 Rejoue !");
    else if(newPos===WIN_POS)showBanner("🎯 Arrivé !");
    try{
      await updateGame(chatId,game.id,{
        board:{...board,[myTK]:newMy,[enTK]:newEn,dice:0,diceRolled:false},
        currentTurn:next,status:won?"finished":"playing",winner:won?myId:null,
      });
    }catch(e){console.error("move:",e);}
  }

  const movable=(!isMyTurn||!rolled)?[]:myT.map((p,i)=>{
    if(p===WIN_POS)return -1;
    if(p===-1&&dice===6)return i;
    if(p>=0&&p+dice<=WIN_POS)return i;
    return -1;
  }).filter(i=>i>=0);

  const dRotDeg=dRot.interpolate({inputRange:[0,1],outputRange:["0deg","360deg"]});
  const myColor=isP1?P1C:P2C;
  const enColor=isP1?P2C:P1C;
  const myArr=myT.filter(p=>p===WIN_POS).length;
  const enArr=enT.filter(p=>p===WIN_POS).length;
  const fSize=Math.round(C*0.40);
  const starSize=Math.round(C*0.44);
  const arrowSize=Math.round(C*0.50);
  const labelBottom=Math.round(C*0.10);

  return(
    <View style={s.root}>
      <View style={[s.statusBar,{
        backgroundColor:isMyTurn&&!finished?myColor+"22":"rgba(255,255,255,0.04)",
        borderColor:isMyTurn&&!finished?myColor+"88":"#2a2a2a",
      }]}>
        <Text style={[s.statusTxt,{
          color:finished?(game.winner===myId?VERT:"#F44336"):isMyTurn?myColor:"#777",
        }]}>
          {finished
            ?game.winner==="draw"?"🤝 Égalité !":game.winner===myId?"🏆 Gagné !":"😔 Perdu"
            :isMyTurn
              ?rolled?`🎲 ${dice}  —  Choisis un pion`:"Lance le dé !"
              :"⌛ Tour adverse..."}
        </Text>
      </View>

      <View style={s.boardOuter}>
        <View style={[s.board,{width:BOARD,height:BOARD}]}>

          <View style={{position:"absolute",left:0,top:0,width:6*C,height:6*C,backgroundColor:ROUGE}}>
            <DecPocket color={ROUGE} inner={ROUGE_I}/>
            <Text style={[s.label,{bottom:labelBottom,fontSize:fSize}]}>ROUGE</Text>
          </View>
          <View style={{position:"absolute",left:9*C,top:0,width:6*C,height:6*C,backgroundColor:BLEU}}>
            <DecPocket color={BLEU} inner={BLEU_I}/>
            <Text style={[s.label,{bottom:labelBottom,fontSize:fSize}]}>BLEU</Text>
          </View>
          <View style={{position:"absolute",left:0,top:9*C,width:6*C,height:6*C,backgroundColor:VERT}}>
            <DecPocket color={VERT} inner={VERT_I}/>
            <Text style={[s.label,{bottom:labelBottom,fontSize:fSize}]}>VERT</Text>
          </View>
          <View style={{position:"absolute",left:9*C,top:9*C,width:6*C,height:6*C,backgroundColor:JAUNE}}>
            <DecPocket color={JAUNE} inner={JAUNE_I}/>
            <Text style={[s.label,{bottom:labelBottom,fontSize:fSize}]}>JAUNE</Text>
          </View>

          {GRID.map((row,r)=>row.map((cell,c)=>{
            if(cell.type==="ctr"||cell.type.startsWith("h_")||cell.type.startsWith("i_"))return null;
            const sk=`${r},${c}`;
            const hasStar=SAFE_STARS.has(sk);
            const bg=hasStar?"#F5C800":cell.bg;
            return(
              <View key={sk} style={[
                s.cell,{left:c*C,top:r*C,width:C,height:C,backgroundColor:bg},
                !cell.type.startsWith("s_")&&s.pathBorder,
              ]}>
                {hasStar&&<Text style={[s.star,{fontSize:starSize}]}>+</Text>}
                {cell.type==="dp1"&&<Text style={[s.arrow,{color:ROUGE,fontSize:arrowSize}]}>▶</Text>}
                {cell.type==="dp2"&&<Text style={[s.arrow,{color:BLEU, fontSize:arrowSize}]}>▼</Text>}
                {cell.type==="dp3"&&<Text style={[s.arrow,{color:VERT, fontSize:arrowSize}]}>◀</Text>}
                {cell.type==="dp4"&&<Text style={[s.arrow,{color:JAUNE,fontSize:arrowSize}]}>▲</Text>}
              </View>
            );
          }))}

          <View style={[s.dH,{top:6*C}]}/>
          <View style={[s.dH,{top:9*C}]}/>
          <View style={[s.dV,{left:6*C}]}/>
          <View style={[s.dV,{left:9*C}]}/>

          <View style={[s.ctrWrap,{left:6*C,top:6*C,width:3*C,height:3*C}]}>
            <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"#fff"}}/>
            <View style={{position:"absolute",top:0,left:HC,marginLeft:-HC,width:0,height:0,
              borderLeftWidth:HC,borderRightWidth:HC,borderTopWidth:HC,
              borderLeftColor:"transparent",borderRightColor:"transparent",borderTopColor:BLEU}}/>
            <View style={{position:"absolute",bottom:0,left:HC,marginLeft:-HC,width:0,height:0,
              borderLeftWidth:HC,borderRightWidth:HC,borderBottomWidth:HC,
              borderLeftColor:"transparent",borderRightColor:"transparent",borderBottomColor:VERT}}/>
            <View style={{position:"absolute",right:0,top:HC,marginTop:-HC,width:0,height:0,
              borderTopWidth:HC,borderBottomWidth:HC,borderRightWidth:HC,
              borderTopColor:"transparent",borderBottomColor:"transparent",borderRightColor:JAUNE}}/>
            <View style={{position:"absolute",left:0,top:HC,marginTop:-HC,width:0,height:0,
              borderTopWidth:HC,borderBottomWidth:HC,borderLeftWidth:HC,
              borderTopColor:"transparent",borderBottomColor:"transparent",borderLeftColor:ROUGE}}/>
            <View style={{
              position:"absolute",top:"50%",left:"50%",
              marginTop:-Math.round(C*0.36),marginLeft:-Math.round(C*0.36),
              width:Math.round(C*0.72),height:Math.round(C*0.72),
              borderRadius:Math.round(C*0.36),backgroundColor:"#fff",
            }}/>
          </View>

          {enT.map((pos,i)=>{
            if(pos===-1||pos===WIN_POS)return null;
            const c=coord(pos,!isP1,i);
            return(
              <View key={`e${i}`} style={{position:"absolute",left:c.x-TR,top:c.y-TR,zIndex:5}}>
                <Tok color={enColor} sz={TR*2}/>
              </View>
            );
          })}

          {myT.map((pos,i)=>{
            const atHome=pos===-1;
            const canM=movable.includes(i);
            if(pos===WIN_POS)return null;
            const c=coord(pos,isP1,i);
            const tokSz=canM&&atHome?P_BOX:TR*2;
            return(
              <Animated.View key={`m${i}`} style={{
                position:"absolute",
                left:atHome?-Math.round(P_BOX/2):-TR,
                top:atHome?-Math.round(P_BOX/2):-TR,
                zIndex:canM?10:atHome?1:5,
                transform:[
                  {translateX:tAnims[i].cx},
                  {translateY:tAnims[i].cy},
                  {scale:tAnims[i].s},
                ],
              }}>
                <TouchableOpacity
                  onPress={()=>canM&&move(i)}
                  activeOpacity={canM?0.65:1}
                  style={{width:tokSz,height:tokSz,alignItems:"center",justifyContent:"center"}}>
                  {canM&&(
                    <View style={{
                      position:"absolute",
                      top:-5,left:-5,right:-5,bottom:-5,
                      borderRadius:Math.round(tokSz/2)+5,
                      borderWidth:3,borderColor:"#FFD700",
                      shadowColor:"#FFD700",shadowOpacity:0.90,shadowRadius:10,elevation:10,
                    }}/>
                  )}
                  {(!atHome||canM)&&<Tok color={myColor} sz={tokSz} gold={canM}/>}
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <View pointerEvents="none" style={s.boardBorder}/>

          {banner&&(
            <Animated.View style={[s.banner,{transform:[{scale:banAnim}],opacity:banAnim}]}>
              <Text style={s.bannerTxt}>{banner}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      <View style={s.controls}>
        <View style={[s.sBox,{borderColor:isMyTurn&&!finished?myColor+"88":"#1e1e1e"}]}>
          <View style={[s.sDot,{backgroundColor:myColor}]}/>
          <Text style={s.sLbl}>Toi</Text>
          <Text style={s.sVal}>{myArr}/4</Text>
        </View>
        <TouchableOpacity
          style={[s.dBtn,
            (!isMyTurn||rolled||finished)&&{opacity:0.35},
            isMyTurn&&!rolled&&!finished&&{
              borderColor:myColor,
              shadowColor:myColor,shadowOpacity:0.65,shadowRadius:12,elevation:10,
            },
          ]}
          onPress={roll}
          disabled={!isMyTurn||rolled||finished||rolling}
          activeOpacity={0.8}>
          <Animated.Text style={[s.dFace,{transform:[{rotate:dRotDeg},{scale:dScale}]}]}>
            {rolling?"🎲":dice>0?FACES[dice-1]:"🎲"}
          </Animated.Text>
          {dice>0&&!rolling&&<Text style={s.dNum}>{dice}</Text>}
        </TouchableOpacity>
        <View style={[s.sBox,{borderColor:!isMyTurn&&!finished?enColor+"88":"#1e1e1e"}]}>
          <View style={[s.sDot,{backgroundColor:enColor}]}/>
          <Text style={s.sLbl}>Adv.</Text>
          <Text style={s.sVal}>{enArr}/4</Text>
        </View>
      </View>

      <Text style={s.hint}>
        {isMyTurn?rolled?"👆 Touche un pion doré":"🎲 Lance le dé !":"⌛ Attends ton tour"}
      </Text>

      <GameResultModal
        result={!finished?null:game.winner==="draw"?"draw":game.winner===myId?"win":"lose"}
        onClose={()=>navigation.goBack()}
      />
    </View>
  );
}

const s=StyleSheet.create({
  root:{alignItems:"center",backgroundColor:"#111",flex:1,paddingVertical:8,gap:8},
  statusBar:{paddingHorizontal:20,paddingVertical:8,borderRadius:22,borderWidth:2},
  statusTxt:{fontSize:13,fontWeight:"800",textAlign:"center"},
  boardOuter:{borderRadius:6,borderWidth:4,borderColor:"#111",
    shadowColor:"#000",shadowOpacity:0.55,shadowRadius:10,elevation:10},
  board:{position:"relative",borderRadius:3,overflow:"hidden",backgroundColor:"#FAFAFA"},
  label:{position:"absolute",left:0,right:0,textAlign:"center",
    color:"#fff",fontWeight:"900",letterSpacing:1,
    textShadowColor:"rgba(0,0,0,0.40)",textShadowOffset:{width:0,height:1},textShadowRadius:3},
  cell:{position:"absolute",alignItems:"center",justifyContent:"center"},
  pathBorder:{borderWidth:1,borderColor:"rgba(0,0,0,0.13)"},
  star:{color:"#D4A000",fontWeight:"900"},
  arrow:{fontWeight:"900"},
  dH:{position:"absolute",left:0,right:0,height:BW,backgroundColor:"#000",zIndex:3},
  dV:{position:"absolute",top:0,bottom:0,width:BW,backgroundColor:"#000",zIndex:3},
  ctrWrap:{position:"absolute",overflow:"hidden",zIndex:2},
  boardBorder:{position:"absolute",top:0,left:0,right:0,bottom:0,
    borderWidth:3,borderColor:"#000",zIndex:4,borderRadius:3},
  banner:{position:"absolute",top:"36%",left:"8%",right:"8%",
    backgroundColor:"rgba(0,0,0,0.92)",borderRadius:14,
    padding:14,alignItems:"center",zIndex:99},
  bannerTxt:{color:"#fff",fontSize:22,fontWeight:"900",textAlign:"center"},
  controls:{flexDirection:"row",alignItems:"center",gap:14,width:"92%"},
  sBox:{flex:1,backgroundColor:"#1a1a1a",borderRadius:14,padding:12,
    alignItems:"center",gap:4,borderWidth:2},
  sDot:{width:18,height:18,borderRadius:9},
  sLbl:{color:"#555",fontSize:11,fontWeight:"700"},
  sVal:{color:"#fff",fontSize:20,fontWeight:"900"},
  dBtn:{width:88,height:88,backgroundColor:"#1a1a1a",borderRadius:20,
    alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:"#2a2a2a",gap:2},
  dFace:{fontSize:44},
  dNum:{color:"#fff",fontSize:14,fontWeight:"900",marginTop:-4},
  hint:{color:"#2e2e2e",fontSize:11,textAlign:"center",paddingHorizontal:16,fontWeight:"600"},
});