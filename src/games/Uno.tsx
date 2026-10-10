import React,{useState,useEffect,useRef}from"react";
import{
  View,Text,TouchableOpacity,StyleSheet,
  ScrollView,Dimensions,Vibration,Animated,
}from"react-native";
import{useNavigation}from"@react-navigation/native";
import{GameDoc,updateGame}from"./gameService";
import{GameResultModal}from"./GameResultModal";

const{width}=Dimensions.get("window");

type UnoColor="red"|"blue"|"green"|"yellow"|"wild";
interface Card{color:UnoColor;value:string;id:string;}

const CC:Record<string,string>={
  red:"#CC2200",blue:"#1255BB",green:"#1A7A1A",yellow:"#CC8800",wild:"#111",
};
const CN:Record<string,string>={red:"Rouge",blue:"Bleu",green:"Vert",yellow:"Jaune"};
const UNO_COLORS:UnoColor[]=["red","blue","green","yellow"];
const CW=62,CH=90,DW=76,DH=108;

function shuffle<T>(a:T[]):T[]{
  const r=[...a];
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
}

function createDeck():Card[]{
  let id=0;const cards:Card[]=[];
  const cols:UnoColor[]=["red","blue","green","yellow"];
  cols.forEach(c=>{
    cards.push({color:c,value:"0",id:`c${id++}`});
    for(const v of["1","2","3","4","5","6","7","8","9","skip","reverse","+2"]){
      cards.push({color:c,value:v,id:`c${id++}`});
      cards.push({color:c,value:v,id:`c${id++}`});
    }
  });
  for(let i=0;i<4;i++){
    cards.push({color:"wild",value:"wild",id:`c${id++}`});
    cards.push({color:"wild",value:"+4",id:`c${id++}`});
  }
  return shuffle(cards);
}

function canPlay(card:Card,top:Card|undefined,cc:UnoColor,ds:number):boolean{
  if(!top)return true;
  if(ds>0)return card.value===top.value;
  if(card.color==="wild")return true;
  return card.color===cc||card.value===top.value;
}

function toArr<T>(v:any):T[]{
  if(!v)return[];
  if(Array.isArray(v))return v;
  return Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]);
}

function valLabel(v:string):string{
  if(v==="skip")return"⊘";
  if(v==="reverse")return"↺";
  if(v==="wild")return"";
  return v;
}

function UnoCard({card,w=CW,h=CH,playable=false,faceDown=false,onPress,style,rotate=0}:{
  card:Card;w?:number;h?:number;playable?:boolean;faceDown?:boolean;
  onPress?:()=>void;style?:any;rotate?:number;
}){
  const scaleAnim=useRef(new Animated.Value(1)).current;
  function handlePress(){
    if(!onPress)return;
    Animated.sequence([
      Animated.timing(scaleAnim,{toValue:0.92,duration:80,useNativeDriver:true}),
      Animated.timing(scaleAnim,{toValue:1,duration:80,useNativeDriver:true}),
    ]).start();
    onPress();
  }
  const ow=Math.round(w*0.82);
  const oh=Math.round(h*0.76);
  const or=Math.round(w*0.41);
  const wc=Math.round(w*0.52);
  const wr=Math.round(w*0.26);

  if(faceDown){
    return(
      <Animated.View style={[cs.card,{width:w,height:h},cs.cardBack,style,
        {transform:[{rotate:`${rotate}deg`},{scale:scaleAnim}]}]}>
        <Text style={cs.backTxt}>UNO</Text>
      </Animated.View>
    );
  }
  const bg=CC[card.color];
  const lbl=valLabel(card.value);
  const isWild=card.color==="wild";
  const isLong=card.value.length>2;
  return(
    <TouchableOpacity onPress={handlePress} disabled={!onPress} activeOpacity={0.85}>
      <Animated.View style={[cs.card,{width:w,height:h,backgroundColor:bg},
        playable&&cs.playable,style,
        {transform:[{rotate:`${rotate}deg`},{scale:scaleAnim}]}]}>
        {!isWild&&<Text style={[cs.corner,cs.tl]}>{lbl}</Text>}
        <View style={[cs.oval,{width:ow,height:oh,borderRadius:or}]}>
          <View style={cs.ovalInner}>
            {isWild?(
              <View style={[cs.wildCircle,{width:wc,height:wc,borderRadius:wr}]}>
                <View style={cs.wq1}/><View style={cs.wq2}/>
                <View style={cs.wq3}/><View style={cs.wq4}/>
              </View>
            ):(
              <Text style={[cs.bigVal,isLong&&cs.bigValSm]}>{lbl}</Text>
            )}
          </View>
        </View>
        {!isWild&&<Text style={[cs.corner,cs.br]}>{lbl}</Text>}
        {playable&&<View style={cs.playableGlow}/>}
      </Animated.View>
    </TouchableOpacity>
  );
}

function ColorPicker({onChoose}:{onChoose:(c:UnoColor)=>void}){
  return(
    <View style={cs.overlay}>
      <View style={cs.pickerCard}>
        <Text style={cs.pickerTitle}>Choisis une couleur</Text>
        <View style={cs.pickerGrid}>
          {UNO_COLORS.map(c=>(
            <TouchableOpacity key={c} style={[cs.pickerBtn,{backgroundColor:CC[c]}]}
              onPress={()=>onChoose(c)} activeOpacity={0.8}>
              <View style={cs.pickerOval}>
                <Text style={cs.pickerBtnTxt}>{CN[c]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

interface Props{game:GameDoc;chatId:string;myId:string;}

export function Uno({game,chatId,myId}:Props){
  const navigation=useNavigation();
  const isP1=myId===game.player1;
  const myTK=isP1?"p1Hand":"p2Hand";
  const enTK=isP1?"p2Hand":"p1Hand";
  const board=game.board||{};
  const myHand:Card[]=toArr(board[myTK]);
  const enHand:Card[]=toArr(board[enTK]);
  const deck:Card[]=toArr(board.deck);
  const discard:Card[]=toArr(board.discard);
  const topCard=discard.length>0?discard[discard.length-1]:undefined;
  const currentColor:UnoColor=board.currentColor||"red";
  const drawStack:number=board.drawStack||0;
  const isMyTurn=game.currentTurn===myId;
  const finished=game.status==="finished";
  const[loading,setLoading]=useState(false);
  const[choosingColor,setChoosingColor]=useState(false);
  const[pendingWild,setPendingWild]=useState<Card|null>(null);
  const[saidUno,setSaidUno]=useState(false);

  useEffect(()=>{
    if(!board.initialized&&isP1&&!loading){
      setLoading(true);
      initGame().finally(()=>setLoading(false));
    }
  },[]);

  useEffect(()=>{if(!isMyTurn)setSaidUno(false);},[isMyTurn]);

  async function initGame(){
    const d=createDeck();
    const p1Hand=d.splice(0,7);
    const p2Hand=d.splice(0,7);
    let fi=d.findIndex(c=>c.color!=="wild"&&c.value!=="+4");
    if(fi<0)fi=0;
    const[first]=d.splice(fi,1);
    let ds=0,startP=game.player1;
    if(first.value==="skip"||first.value==="reverse")startP=game.player2;
    if(first.value==="+2"){ds=2;startP=game.player2;}
    await updateGame(chatId,game.id,{
      board:{initialized:true,deck:d,discard:[first],p1Hand,p2Hand,
        currentColor:first.color as UnoColor,direction:1,drawStack:ds},
      currentTurn:startP,status:"playing",
    });
  }

  async function playCard(card:Card){
    if(!isMyTurn||finished||loading)return;
    if(!canPlay(card,topCard,currentColor,drawStack))return;
    Vibration.vibrate(12);
    if(card.color==="wild"){setPendingWild(card);setChoosingColor(true);return;}
    setLoading(true);
    const newMy=myHand.filter(c=>c.id!==card.id);
    const newDiscard=[...discard,card];
    const newColor=card.color as UnoColor;
    if(newMy.length===0){
      await updateGame(chatId,game.id,{
        board:{...board,[myTK]:newMy,discard:newDiscard,currentColor:newColor,drawStack:0},
        currentTurn:myId,status:"finished",winner:myId,
      });
      setLoading(false);return;
    }
    const other=game.currentTurn===game.player1?game.player2:game.player1;
    let nextTurn=other;let newStack=0;
    if(card.value==="+2")newStack=drawStack+2;
    if(card.value==="skip"||card.value==="reverse")nextTurn=myId;
    await updateGame(chatId,game.id,{
      board:{...board,[myTK]:newMy,discard:newDiscard,currentColor:newColor,drawStack:newStack},
      currentTurn:nextTurn,
    });
    setLoading(false);
  }

  async function chooseColor(color:UnoColor){
    if(!pendingWild)return;
    setChoosingColor(false);setLoading(true);
    const newMy=myHand.filter(c=>c.id!==pendingWild.id);
    const newDiscard=[...discard,pendingWild];
    const other=game.currentTurn===game.player1?game.player2:game.player1;
    const newStack=pendingWild.value==="+4"?drawStack+4:0;
    if(newMy.length===0){
      await updateGame(chatId,game.id,{
        board:{...board,[myTK]:newMy,discard:newDiscard,currentColor:color,drawStack:0},
        currentTurn:myId,status:"finished",winner:myId,
      });
    }else{
      await updateGame(chatId,game.id,{
        board:{...board,[myTK]:newMy,discard:newDiscard,currentColor:color,drawStack:newStack},
        currentTurn:other,
      });
    }
    setPendingWild(null);setLoading(false);
  }

  async function drawAction(){
    if(!isMyTurn||finished||loading)return;
    Vibration.vibrate(8);setLoading(true);
    const num=drawStack>0?drawStack:1;
    let nd=[...deck];let nDiscard=[...discard];
    if(nd.length<num){
      const refill=shuffle(nDiscard.slice(0,-1));
      nd=[...nd,...refill];nDiscard=nDiscard.slice(-1);
    }
    const drawn=nd.splice(0,num);
    const newMy=[...myHand,...drawn];
    const other=game.currentTurn===game.player1?game.player2:game.player1;
    await updateGame(chatId,game.id,{
      board:{...board,[myTK]:newMy,deck:nd,discard:nDiscard,drawStack:0},
      currentTurn:other,
    });
    setLoading(false);
  }

  const N=myHand.length;
  const maxA=Math.min(20,N*2.8);
  function angle(i:number){
    if(N<=1)return 0;
    return-maxA+(i/(N-1))*maxA*2;
  }
  const oppN=enHand.length;
  const playableCards=myHand.filter(c=>canPlay(c,topCard,currentColor,drawStack));

  return(
    <View style={s.root}>

      {/* Adversaire */}
      <View style={s.topZone}>
        <View style={s.oppHand}>
          {Array(Math.min(oppN,14)).fill(0).map((_,i)=>{
            const a=(i-(Math.min(oppN,14)-1)/2)*3;
            return(
              <View key={i} style={[s.miniCard,{
                marginLeft:i===0?0:-14,
                transform:[{rotate:`${a}deg`}],
                zIndex:i,
              }]}/>
            );
          })}
          {oppN>14&&<Text style={s.moreText}>+{oppN-14}</Text>}
        </View>
        <View style={s.oppInfo}>
          <View style={[s.ava,{backgroundColor:"#1255BB"}]}>
            <Text style={s.avaLet}>{isP1?"A":"T"}</Text>
            {!isMyTurn&&!finished&&<View style={s.avaDot}/>}
          </View>
          <View>
            <Text style={s.oppName}>{isP1?"Adversaire":"Toi"}</Text>
            <Text style={s.oppSub}>{oppN} carte{oppN!==1?"s":""}</Text>
          </View>
          {oppN===1&&(
            <View style={s.unoBadge}><Text style={s.unoBadgeTxt}>UNO !</Text></View>
          )}
        </View>
      </View>

      {/* Table */}
      <View style={s.table}>
        <View style={s.statusRow}>
          <View style={[s.colorChip,{backgroundColor:CC[currentColor]}]}>
            <Text style={s.colorChipTxt}>{CN[currentColor]||"?"}</Text>
          </View>
          {drawStack>0?(
            <View style={s.warnChip}>
              <Text style={s.warnChipTxt}>⚠️ Pioche {drawStack} ou empile</Text>
            </View>
          ):(
            <View style={[s.turnChip,isMyTurn?s.turnChipActive:s.turnChipWait]}>
              <Text style={[s.turnChipTxt,{color:isMyTurn?"#FFD700":"rgba(255,255,255,0.4)"}]}>
                {isMyTurn?"⚡ À ton tour":"⌛ Tour adversaire"}
              </Text>
            </View>
          )}
        </View>

        <View style={s.piles}>
          <View style={s.pileWrap}>
            <View style={{position:"relative"}}>
              {discard.length>1&&(
                <UnoCard card={discard[discard.length-2]} w={DW} h={DH}
                  style={{position:"absolute",top:5,left:5,opacity:0.55}}/>
              )}
              {topCard?(
                <UnoCard card={topCard} w={DW} h={DH}/>
              ):(
                <View style={[cs.card,{width:DW,height:DH,backgroundColor:"rgba(255,255,255,0.08)",borderColor:"rgba(255,255,255,0.2)"}]}/>
              )}
              {topCard?.color==="wild"&&(
                <View style={[s.colorDot,{backgroundColor:CC[currentColor]}]}/>
              )}
            </View>
            <Text style={s.pileLbl}>Défausse</Text>
          </View>

          <Text style={s.arrow}>→</Text>

          <View style={s.pileWrap}>
            <TouchableOpacity onPress={isMyTurn&&!finished?drawAction:undefined}
              disabled={!isMyTurn||finished||loading} activeOpacity={0.8}>
              <View style={{position:"relative"}}>
                <UnoCard card={{color:"wild",value:"back",id:"back"}} faceDown w={DW} h={DH}
                  style={isMyTurn&&!finished?s.drawActive:undefined}/>
                <View style={s.deckBadge}>
                  <Text style={s.deckBadgeTxt}>{deck.length}</Text>
                </View>
              </View>
            </TouchableOpacity>
            <Text style={s.pileLbl}>{drawStack>0?`Piocher ${drawStack}`:"Piocher"}</Text>
          </View>
        </View>

        {isMyTurn&&!finished&&(
          <Text style={s.hint}>
            {playableCards.length>0?"👆 Touche une carte dorée pour jouer":"Aucune carte jouable — pioche !"}
          </Text>
        )}
      </View>

      {/* Ma main */}
      <View style={s.handSection}>
        <View style={s.myInfo}>
          <View style={[s.ava,{backgroundColor:"#CC2200"}]}>
            <Text style={s.avaLet}>{isP1?"T":"A"}</Text>
            {isMyTurn&&!finished&&<View style={[s.avaDot,{backgroundColor:"#22DD66"}]}/>}
          </View>
          <Text style={s.myName}>Toi</Text>
          <Text style={s.myCount}>{myHand.length} carte{myHand.length!==1?"s":""}</Text>
        </View>

        {/* ✅ Fix cartes visibles — height fixe + alignItems center */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{height:130}}
          contentContainerStyle={s.handScroll}>
          {myHand.map((card,i)=>{
            const play=canPlay(card,topCard,currentColor,drawStack)&&isMyTurn&&!finished;
            const a=angle(i);
            // ✅ Fix décimal — Math.round
            const lift=Math.round(Math.abs(a)*0.5);
            return(
              <View key={card.id} style={{
                marginRight:i<myHand.length-1?-16:0,
                marginTop:lift,
                zIndex:play?myHand.length+10:myHand.length-Math.abs(i-Math.round((N-1)/2)),
              }}>
                <UnoCard card={card} playable={play} rotate={Math.round(a)}
                  onPress={play?()=>playCard(card):undefined}/>
              </View>
            );
          })}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity style={s.btnDraw}
            onPress={isMyTurn&&!finished?drawAction:undefined}
            disabled={!isMyTurn||finished||loading}>
            <Text style={s.btnDrawTxt}>{drawStack>0?`＋${drawStack} Piocher`:"＋ Piocher"}</Text>
          </TouchableOpacity>
          {myHand.length<=2&&isMyTurn&&!finished&&(
            <TouchableOpacity
              style={[s.btnUno,saidUno&&s.btnUnoSaid]}
              onPress={()=>{if(!saidUno){setSaidUno(true);Vibration.vibrate([0,60,60,60]);}}}
              activeOpacity={0.8}>
              <Text style={s.btnUnoTxt}>{saidUno?"✓ UNO dit !":"UNO !"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {choosingColor&&<ColorPicker onChoose={chooseColor}/>}

      <GameResultModal
        result={!finished?null:game.winner==="draw"?"draw":game.winner===myId?"win":"lose"}
        onClose={()=>navigation.goBack()}
      />
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:"#0d4a0d"},
  topZone:{
    backgroundColor:"rgba(0,0,0,0.42)",paddingTop:16,paddingBottom:12,paddingHorizontal:16,
    alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,0.08)",
  },
  oppHand:{flexDirection:"row",alignItems:"flex-end",justifyContent:"center",height:58},
  miniCard:{width:28,height:42,borderRadius:5,backgroundColor:"#111177",borderWidth:2,borderColor:"rgba(255,255,255,0.50)",shadowColor:"#000",shadowOpacity:0.5,shadowRadius:4,elevation:3},
  moreText:{color:"rgba(255,255,255,0.5)",fontSize:12,marginLeft:6,alignSelf:"center"},
  oppInfo:{flexDirection:"row",alignItems:"center",gap:10},
  ava:{width:38,height:38,borderRadius:19,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"rgba(255,255,255,0.35)",position:"relative"},
  avaLet:{color:"#fff",fontSize:16,fontWeight:"500"},
  avaDot:{position:"absolute",bottom:-1,right:-1,width:11,height:11,borderRadius:6,backgroundColor:"#22DD66",borderWidth:2,borderColor:"#0d4a0d"},
  oppName:{color:"#fff",fontSize:14,fontWeight:"500"},
  oppSub:{color:"rgba(255,255,255,0.5)",fontSize:11},
  unoBadge:{backgroundColor:"rgba(204,34,0,0.25)",borderRadius:10,paddingHorizontal:10,paddingVertical:3,borderWidth:1,borderColor:"rgba(204,34,0,0.6)"},
  unoBadgeTxt:{color:"#FF6644",fontSize:12,fontWeight:"500"},
  table:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20,gap:14},
  statusRow:{flexDirection:"row",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"center"},
  colorChip:{borderRadius:14,paddingHorizontal:16,paddingVertical:7,borderWidth:2,borderColor:"rgba(255,255,255,0.65)"},
  colorChipTxt:{color:"#fff",fontSize:13,fontWeight:"500"},
  warnChip:{backgroundColor:"rgba(255,80,0,0.20)",borderRadius:14,paddingHorizontal:14,paddingVertical:6,borderWidth:1,borderColor:"rgba(255,80,0,0.5)"},
  warnChipTxt:{color:"#FF8060",fontSize:12,fontWeight:"500"},
  turnChip:{borderRadius:14,paddingHorizontal:14,paddingVertical:6,borderWidth:1},
  turnChipActive:{backgroundColor:"rgba(255,210,0,0.15)",borderColor:"rgba(255,210,0,0.45)"},
  turnChipWait:{backgroundColor:"rgba(0,0,0,0.25)",borderColor:"rgba(255,255,255,0.10)"},
  turnChipTxt:{fontSize:12,fontWeight:"500"},
  piles:{flexDirection:"row",gap:22,alignItems:"flex-end"},
  pileWrap:{alignItems:"center",gap:8},
  pileLbl:{color:"rgba(255,255,255,0.50)",fontSize:11,fontWeight:"500"},
  colorDot:{position:"absolute",bottom:-7,right:-7,width:22,height:22,borderRadius:11,borderWidth:3,borderColor:"#fff",shadowColor:"#000",shadowOpacity:0.5,shadowRadius:4,elevation:5},
  arrow:{color:"rgba(255,255,255,0.35)",fontSize:22,marginBottom:28},
  drawActive:{shadowColor:"#fff",shadowOpacity:0.3,shadowRadius:10,elevation:8},
  deckBadge:{position:"absolute",bottom:8,right:8,backgroundColor:"rgba(0,0,0,0.6)",borderRadius:8,paddingHorizontal:5,paddingVertical:2},
  deckBadgeTxt:{color:"#fff",fontSize:11,fontWeight:"500"},
  hint:{color:"rgba(255,255,255,0.28)",fontSize:11,fontWeight:"500",textAlign:"center"},
  handSection:{backgroundColor:"rgba(0,0,0,0.35)",paddingTop:10,paddingBottom:24,borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.08)",gap:8},
  myInfo:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:16},
  myName:{color:"#fff",fontSize:13,fontWeight:"500",flex:1},
  myCount:{color:"rgba(255,255,255,0.5)",fontSize:12},
  // ✅ alignItems center — cartes bien centrées verticalement
  handScroll:{paddingHorizontal:18,paddingVertical:4,alignItems:"center",minWidth:width,justifyContent:"center"},
  actions:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},
  btnDraw:{backgroundColor:"rgba(0,0,0,0.40)",borderRadius:22,paddingHorizontal:18,paddingVertical:9,borderWidth:1,borderColor:"rgba(255,255,255,0.22)"},
  btnDrawTxt:{color:"rgba(255,255,255,0.85)",fontSize:13,fontWeight:"500"},
  btnUno:{backgroundColor:"#CC2200",borderRadius:22,paddingHorizontal:28,paddingVertical:9,shadowColor:"#CC2200",shadowOpacity:0.55,shadowRadius:10,elevation:6},
  btnUnoSaid:{backgroundColor:"#444"},
  btnUnoTxt:{color:"#fff",fontSize:14,fontWeight:"500",letterSpacing:0.5},
});

const cs=StyleSheet.create({
  card:{borderRadius:10,borderWidth:3,borderColor:"rgba(255,255,255,0.92)",alignItems:"center",justifyContent:"center",position:"relative",shadowColor:"#000",shadowOpacity:0.5,shadowRadius:7,elevation:6,overflow:"hidden"},
  cardBack:{backgroundColor:"#111177",borderColor:"rgba(255,255,255,0.70)"},
  backTxt:{color:"#FFD700",fontSize:14,fontWeight:"500",letterSpacing:1,transform:[{rotate:"-25deg"}]},
  playable:{borderColor:"#FFD700",shadowColor:"#FFD700",shadowOpacity:0.65,shadowRadius:12,elevation:12},
  playableGlow:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(255,215,0,0.08)"},
  oval:{borderWidth:2,borderColor:"rgba(255,255,255,0.45)",alignItems:"center",justifyContent:"center",transform:[{rotate:"30deg"}]},
  ovalInner:{transform:[{rotate:"-30deg"}],alignItems:"center",justifyContent:"center"},
  bigVal:{fontSize:28,fontWeight:"900",color:"#fff",textShadowColor:"rgba(0,0,0,0.45)",textShadowOffset:{width:1,height:1},textShadowRadius:3},
  bigValSm:{fontSize:19},
  corner:{position:"absolute",fontSize:13,fontWeight:"900",color:"#fff",lineHeight:14,textShadowColor:"rgba(0,0,0,0.35)",textShadowOffset:{width:0,height:1},textShadowRadius:2},
  tl:{top:5,left:7},
  br:{bottom:5,right:7,transform:[{rotate:"180deg"}]},
  wildCircle:{overflow:"hidden"},
  wq1:{position:"absolute",top:0,left:0,width:"50%",height:"50%",backgroundColor:"#CC2200"},
  wq2:{position:"absolute",top:0,right:0,width:"50%",height:"50%",backgroundColor:"#CC8800"},
  wq3:{position:"absolute",bottom:0,left:0,width:"50%",height:"50%",backgroundColor:"#1A7A1A"},
  wq4:{position:"absolute",bottom:0,right:0,width:"50%",height:"50%",backgroundColor:"#1255BB"},
  overlay:{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundColor:"rgba(0,0,0,0.78)",alignItems:"center",justifyContent:"center",zIndex:99},
  pickerCard:{backgroundColor:"#1a1a1a",borderRadius:20,padding:26,alignItems:"center",gap:20,width:"82%",borderWidth:1,borderColor:"rgba(255,255,255,0.15)"},
  pickerTitle:{color:"#fff",fontSize:17,fontWeight:"500"},
  pickerGrid:{flexDirection:"row",flexWrap:"wrap",gap:14,justifyContent:"center"},
  pickerBtn:{width:88,height:88,borderRadius:18,alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:"rgba(255,255,255,0.75)"},
  pickerOval:{width:72,height:52,borderRadius:36,borderWidth:2,borderColor:"rgba(255,255,255,0.45)",alignItems:"center",justifyContent:"center",transform:[{rotate:"30deg"}]},
  pickerBtnTxt:{transform:[{rotate:"-30deg"}],color:"#fff",fontSize:12,fontWeight:"500"},
});