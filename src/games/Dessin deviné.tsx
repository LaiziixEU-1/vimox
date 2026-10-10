import React,{useState,useEffect,useRef}from"react";
import{
  View,Text,TouchableOpacity,StyleSheet,Animated,
  PanResponder,Dimensions,Vibration,
  TextInput,KeyboardAvoidingView,Platform,ScrollView,
}from"react-native";
import Svg,{Path}from"react-native-svg";
import{useNavigation}from"@react-navigation/native";
import{GameDoc,updateGame}from"./gameService";
import{GameResultModal}from"./GameResultModal";

const{width}=Dimensions.get("window");
const WORDS=[
  "licorne","fusée","château","dragon","baleine","parapluie","guitare",
  "étoile","banane","lion","avion","bateau","maison","soleil","lune",
  "pizza","robot","vélo","arbre","poisson","montagne","chocolat",
  "bougie","couronne","sorcière","cactus","dauphin","hibou","pieuvre",
  "panda","chaussure","bouquet","igloo","phare","vampire","requin",
  "papillon","champignon","dinosaure","montgolfière","perroquet",
];
const COLORS=["#1a1a1a","#fff","#E53935","#FF9800","#FFD700","#43A047","#1E88E5","#9C27B0","#FF4F8B","#00BCD4"];
const BRUSH_SIZES=[3,6,12,20];
const ROUND_SEC=60;
const TOTAL_ROUNDS=4;
const GREEN="#00E676";const GOLD="#FFD700";const PURPLE="#6C63FF";const PINK="#FF4F8B";

type Pt={x:number;y:number};
type Stroke={id:string;d:string;c:string;sz:number};
type Guess={uid:string;txt:string;ok:boolean;ts:number};

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2);}
function toArr<T>(v:any):T[]{
  if(!v)return[];
  if(Array.isArray(v))return v;
  return Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]);
}
function ptsToD(pts:Pt[]):string{
  if(!pts.length)return"";
  if(pts.length===1)return`M${pts[0].x},${pts[0].y}l.1,.1`;
  return pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
}
function rndWord(){return WORDS[Math.floor(Math.random()*WORDS.length)];}
function normalize(s:string){return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}

// ✅ DrawCanvas avec TOUS les refs — canDraw, onStroke, curColor, curSize
function DrawCanvas({strokes,curColor,curSize,canDraw,onStroke,w,h}:{
  strokes:Stroke[];curColor:string;curSize:number;
  canDraw:boolean;onStroke:(s:Stroke)=>void;w:number;h:number;
}){
  const ptsRef=useRef<Pt[]>([]);
  const strokeIdRef=useRef("");
  const[localPts,setLocalPts]=useState<Pt[]>([]);

  // ✅ Refs toujours à jour — PanResponder ne capture plus les vieilles valeurs
  const canDrawRef=useRef(canDraw);
  const onStrokeRef=useRef(onStroke);
  const curColorRef=useRef(curColor);
  const curSizeRef=useRef(curSize);
  useEffect(()=>{canDrawRef.current=canDraw;},[canDraw]);
  useEffect(()=>{onStrokeRef.current=onStroke;});
  useEffect(()=>{curColorRef.current=curColor;},[curColor]);
  useEffect(()=>{curSizeRef.current=curSize;},[curSize]);

  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>canDrawRef.current,
    onMoveShouldSetPanResponder:()=>canDrawRef.current,
    onPanResponderGrant:(e)=>{
      if(!canDrawRef.current)return;
      const{locationX:x,locationY:y}=e.nativeEvent;
      strokeIdRef.current=uid();
      ptsRef.current=[{x,y}];
      setLocalPts([{x,y}]);
    },
    onPanResponderMove:(e)=>{
      if(!canDrawRef.current)return;
      const{locationX:x,locationY:y}=e.nativeEvent;
      const np=[...ptsRef.current,{x,y}];
      ptsRef.current=np;
      setLocalPts([...np]);
    },
    onPanResponderRelease:()=>{
      if(!canDrawRef.current||!ptsRef.current.length)return;
      onStrokeRef.current({
        id:strokeIdRef.current,
        d:ptsToD(ptsRef.current),
        c:curColorRef.current,
        sz:curSizeRef.current,
      });
      ptsRef.current=[];
      setLocalPts([]);
    },
  })).current;

  return(
    <View style={{width:w,height:h,backgroundColor:"#F8F7FF",borderRadius:16,overflow:"hidden"}}>
      <Svg style={{position:"absolute",top:0,left:0}} width={w} height={h}>
        {strokes.map(st=>(
          <Path key={st.id} d={st.d} stroke={st.c} strokeWidth={st.sz}
            strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        ))}
        {localPts.length>0&&(
          <Path d={ptsToD(localPts)} stroke={curColorRef.current}
            strokeWidth={curSizeRef.current} strokeLinecap="round"
            strokeLinejoin="round" fill="none"/>
        )}
      </Svg>
      <View style={{position:"absolute",top:0,left:0,width:w,height:h}}
        {...(canDraw?pan.panHandlers:{})}/>
      {!canDraw&&(
        <View style={s.waitOverlay} pointerEvents="none">
          <Text style={s.waitTxt}>🎨 Adversaire dessine…</Text>
        </View>
      )}
    </View>
  );
}

interface Props{game:GameDoc;chatId:string;myId:string;}

export function Drawing({game,chatId,myId}:Props){
  const navigation=useNavigation();
  const board=game.board||{};
  const isP1=myId===game.player1;

  const strokes:Stroke[]=toArr(board.strokes);
  const guesses:Guess[]=toArr(board.guesses);
  const word:string=board.word||"";
  const drawerRole:string=board.drawerRole||"p1";
  const phase:string=board.phase||"drawing";
  const round:number=board.round||1;
  const scores:{p1:number;p2:number}=board.scores||{p1:0,p2:0};
  const roundEndAt:number=board.roundEndAt||0;
  const foundBy:string|null=board.foundBy||null;
  const finished=game.status==="finished";

  // ✅ amDrawer recalculé à chaque render depuis Firebase
  const amDrawer=(isP1&&drawerRole==="p1")||(!isP1&&drawerRole==="p2");
  const myScore=isP1?scores.p1:scores.p2;
  const enScore=isP1?scores.p2:scores.p1;

  const[curColor,setCurColor]=useState(COLORS[0]);
  const[curSize,setCurSize]=useState(6);
  const[localStrokes,setLocalStrokes]=useState<Stroke[]>([]);
  const[guess,setGuess]=useState("");
  const[timeLeft,setTimeLeft]=useState(ROUND_SEC);
  const[canvasW,setCanvasW]=useState(width-24);
  const[showResult,setShowResult]=useState(false);
  const chatRef=useRef<ScrollView>(null);

  // Reset strokes à chaque changement de manche
  useEffect(()=>{
    setLocalStrokes(strokes);
  },[board.strokes,round]);

  // ✅ Timer — fonctionne pour LES DEUX joueurs
  useEffect(()=>{
    if(!roundEndAt||roundEndAt<=0||phase!=="drawing")return;
    const tick=async()=>{
      const rem=Math.max(0,Math.round((roundEndAt-Date.now())/1000));
      setTimeLeft(rem);
      if(rem<=0){
        // Les deux joueurs peuvent déclencher — guard sur phase
        if(board.phase==="drawing"&&!board.foundBy){
          await handleTimeUp();
        }
      }
    };
    tick();
    const iv=setInterval(tick,500);
    return()=>clearInterval(iv);
  },[roundEndAt,phase,round]);

  // Init jeu
  useEffect(()=>{
    if(!board.initialized){
      initGame();
    }
  },[]);

  // Show result quand quelqu'un a trouvé
  useEffect(()=>{
    if(phase==="revealed")setShowResult(true);
  },[phase]);

  async function initGame(){
    const w=rndWord();
    const endAt=Date.now()+ROUND_SEC*1000;
    await updateGame(chatId,game.id,{
      board:{
        initialized:true,strokes:[],guesses:[],word:w,
        drawerRole:"p1",phase:"drawing",round:1,
        scores:{p1:0,p2:0},roundEndAt:endAt,foundBy:null,
      },
      currentTurn:game.player1,status:"playing",
    });
  }

  async function handleTimeUp(){
    // Guard — évite double déclenchement
    if(board.phase!=="drawing"||board.foundBy)return;
    await updateGame(chatId,game.id,{
      board:{...board,phase:"revealed",foundBy:null},
    }).catch(()=>{});
  }

  async function nextRound(){
    setShowResult(false);
    if(round>=TOTAL_ROUNDS){
      const winner=scores.p1>scores.p2?game.player1
        :scores.p1<scores.p2?game.player2:"draw";
      await updateGame(chatId,game.id,{
        board:{...board,phase:"finished"},
        status:"finished",winner,
      });
      return;
    }
    // ✅ Alterne le dessinateur
    const newDrawer=drawerRole==="p1"?"p2":"p1";
    const w=rndWord();
    const endAt=Date.now()+ROUND_SEC*1000;
    setLocalStrokes([]);
    setGuess("");
    await updateGame(chatId,game.id,{
      board:{
        ...board,
        strokes:[],guesses:[],word:w,
        drawerRole:newDrawer,
        phase:"drawing",
        round:round+1,
        roundEndAt:endAt,
        foundBy:null,
      },
      currentTurn:newDrawer==="p1"?game.player1:game.player2,
    });
  }

  // ✅ onStroke accumule correctement
  async function onStroke(stroke:Stroke){
    if(!amDrawer||phase!=="drawing")return;
    setLocalStrokes(prev=>{
      const ns=[...prev,stroke];
      updateGame(chatId,game.id,{board:{...board,strokes:ns}}).catch(()=>{});
      return ns;
    });
  }

  async function clearCanvas(){
    if(!amDrawer)return;
    setLocalStrokes([]);
    await updateGame(chatId,game.id,{board:{...board,strokes:[]}});
  }

  async function sendGuess(){
    const txt=guess.trim();
    if(!txt||phase!=="drawing"||amDrawer)return;
    setGuess("");
    const isOk=normalize(txt)===normalize(word);
    const ng:Guess={uid:myId,txt,ok:isOk,ts:Date.now()};
    const newGuesses=[...guesses,ng];
    if(isOk){
      Vibration.vibrate([0,50,50,100]);
      const tl=Math.max(0,Math.round((roundEndAt-Date.now())/1000));
      // ✅ Points réalistes : base 100 + bonus vitesse proportionnel
      const speedBonus=Math.round((tl/ROUND_SEC)*150);
      const guesserPts=100+speedBonus;
      const drawerPts=80;
      const newScores={...scores};
      const mk=isP1?"p1":"p2";const ek=isP1?"p2":"p1";
      newScores[mk]=(newScores[mk]||0)+guesserPts;
      newScores[ek]=(newScores[ek]||0)+drawerPts;
      await updateGame(chatId,game.id,{
        board:{...board,guesses:newGuesses,phase:"revealed",foundBy:myId,scores:newScores},
      });
    }else{
      await updateGame(chatId,game.id,{board:{...board,guesses:newGuesses}});
    }
    setTimeout(()=>chatRef.current?.scrollToEnd({animated:true}),100);
  }

  const timerColor=timeLeft<=10?"#E53935":timeLeft<=20?GOLD:GREEN;

  return(
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS==="ios"?"padding":undefined}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.pslot}>
          <View style={[s.ava,{backgroundColor:PINK}]}>
            <Text style={s.avaLet}>{isP1?"T":"A"}</Text>
          </View>
          <View>
            <Text style={s.pname}>{isP1?"Toi":"Adv."}</Text>
            <View style={[s.rolePill,amDrawer?s.roleD:s.roleG]}>
              <Text style={s.roleTxt}>{amDrawer?"✏️ Dessines":"🔍 Devines"}</Text>
            </View>
          </View>
        </View>

        <View style={s.timerWrap}>
          <View style={[s.timerRing,{borderColor:timerColor}]}>
            <Text style={[s.timerNum,{color:timerColor}]}>{timeLeft}</Text>
          </View>
          <Text style={s.timerSub}>SEC</Text>
          <Text style={s.timerRound}>M.{round}/{TOTAL_ROUNDS}</Text>
        </View>

        <View style={[s.pslot,{alignItems:"flex-end"}]}>
          <View style={[s.ava,{backgroundColor:PURPLE}]}>
            <Text style={s.avaLet}>{isP1?"A":"T"}</Text>
          </View>
          <View style={{alignItems:"flex-end"}}>
            <Text style={s.pname}>{isP1?"Adv.":"Toi"}</Text>
            <View style={[s.rolePill,!amDrawer?s.roleD:s.roleG]}>
              <Text style={s.roleTxt}>{!amDrawer?"✏️ Dessines":"🔍 Devines"}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Scores + Mot */}
      <View style={s.scoreRow}>
        <View style={s.scoreItem}>
          <Text style={s.scoreLbl}>{isP1?"Toi":"Adv."}</Text>
          <Text style={s.scoreVal}>{myScore}</Text>
        </View>
        <View style={s.wordArea}>
          {amDrawer?(
            <>
              <Text style={s.wordHint}>MOT À DESSINER</Text>
              <Text style={s.wordSecret}>{word.toUpperCase()}</Text>
            </>
          ):(
            <>
              <Text style={s.wordHint}>{word.length} lettres</Text>
              <View style={s.blanksRow}>
                {word.split("").map((_,i)=>(
                  <View key={i} style={[s.blank,phase==="revealed"&&s.blankDone]}/>
                ))}
              </View>
              {phase==="revealed"&&<Text style={s.revealWord}>{word.toUpperCase()}</Text>}
            </>
          )}
        </View>
        <View style={[s.scoreItem,{alignItems:"flex-end"}]}>
          <Text style={s.scoreLbl}>{isP1?"Adv.":"Toi"}</Text>
          <Text style={s.scoreVal}>{enScore}</Text>
        </View>
      </View>

      {/* Canvas */}
      <View style={s.canvasWrap} onLayout={e=>setCanvasW(e.nativeEvent.layout.width)}>
        <DrawCanvas
          strokes={localStrokes}
          curColor={curColor}
          curSize={curSize}
          canDraw={amDrawer&&phase==="drawing"}
          onStroke={onStroke}
          w={canvasW}
          h={220}
        />
      </View>

      {/* Toolbar dessinateur */}
      {amDrawer&&phase==="drawing"&&(
        <View style={s.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{flexDirection:"row",gap:6,alignItems:"center",paddingHorizontal:4}}>
            {COLORS.map((c,i)=>(
              <TouchableOpacity key={i} onPress={()=>setCurColor(c)}
                style={[s.swatch,{backgroundColor:c},curColor===c&&s.swatchOn,
                  c==="#fff"&&{borderColor:"rgba(0,0,0,0.2)"}]}/>
            ))}
          </ScrollView>
          <View style={s.brushRow}>
            {BRUSH_SIZES.map(sz=>(
              <TouchableOpacity key={sz} onPress={()=>setCurSize(sz)}
                style={[s.brushBtn,curSize===sz&&s.brushBtnOn]}>
                <View style={{
                  width:Math.round(sz*1.4),height:Math.round(sz*1.4),
                  borderRadius:Math.round(sz*0.7),
                  backgroundColor:curColor==="#fff"?"#999":curColor,
                  opacity:curSize===sz?1:0.35,
                }}/>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={clearCanvas} style={s.clearBtn}>
              <Text style={{fontSize:18}}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat guesses */}
      <ScrollView ref={chatRef} style={s.chat}
        contentContainerStyle={{gap:5,paddingBottom:4}}>
        <Text style={s.chatSys}>
          {amDrawer?"— Fais deviner le mot —":"— Tape ta réponse —"}
        </Text>
        {guesses.map((g,i)=>{
          const mine=g.uid===myId;
          return(
            <View key={i} style={[s.msgRow,mine&&{flexDirection:"row-reverse"}]}>
              <View style={[s.msgAva,{backgroundColor:g.uid===game.player1?PINK:PURPLE}]}>
                <Text style={s.msgAvaLet}>
                  {g.uid===game.player1?(isP1?"T":"A"):(isP1?"A":"T")}
                </Text>
              </View>
              <View style={[s.bubble,mine?s.bubbleMe:s.bubbleOther,g.ok&&s.bubbleOk]}>
                <Text style={[s.bubbleTxt,g.ok&&{color:GREEN,fontWeight:"700"}]}>
                  {g.ok?`🎉 ${g.txt.toUpperCase()} !`:g.txt}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input devineur */}
      {!amDrawer&&phase==="drawing"&&(
        <View style={s.inputRow}>
          <TextInput
            style={s.input} value={guess} onChangeText={setGuess}
            placeholder="Ta réponse..." placeholderTextColor="rgba(255,255,255,0.28)"
            returnKeyType="send" onSubmitEditing={sendGuess}
          />
          <TouchableOpacity style={s.sendBtn} onPress={sendGuess}>
            <Text style={s.sendTxt}>→</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Résultat manche */}
      {showResult&&(
        <View style={s.resultCard}>
          <Text style={s.resultTitle}>
            {foundBy
              ?(foundBy===myId?"🎉 Tu as trouvé !":"😅 Raté ! Le mot était :")
              :"⏰ Temps écoulé ! Le mot était :"}
          </Text>
          <Text style={s.resultWord}>{word.toUpperCase()}</Text>
          {round<TOTAL_ROUNDS?(
            <TouchableOpacity style={s.nextBtn} onPress={nextRound}>
              <Text style={s.nextTxt}>▶ Manche suivante ({round}/{TOTAL_ROUNDS})</Text>
            </TouchableOpacity>
          ):(
            <TouchableOpacity style={s.nextBtn} onPress={nextRound}>
              <Text style={s.nextTxt}>🏆 Voir les résultats</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <GameResultModal
        result={!finished?null:game.winner==="draw"?"draw":game.winner===myId?"win":"lose"}
        onClose={()=>navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:"#0F0E1A"},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
    paddingHorizontal:14,paddingTop:16,paddingBottom:10,
    backgroundColor:"rgba(108,99,255,0.10)",
    borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,0.06)"},
  pslot:{flexDirection:"row",alignItems:"center",gap:8,flex:1},
  ava:{width:40,height:40,borderRadius:13,alignItems:"center",justifyContent:"center",
    borderWidth:2,borderColor:"rgba(255,255,255,0.22)"},
  avaLet:{color:"#fff",fontSize:16,fontWeight:"700"},
  pname:{color:"#fff",fontSize:13,fontWeight:"600"},
  rolePill:{borderRadius:8,paddingHorizontal:7,paddingVertical:2,marginTop:2},
  roleD:{backgroundColor:"rgba(108,99,255,0.28)"},
  roleG:{backgroundColor:"rgba(255,79,139,0.22)"},
  roleTxt:{fontSize:10,fontWeight:"600",color:"rgba(255,255,255,0.85)"},
  timerWrap:{alignItems:"center",gap:2},
  timerRing:{width:56,height:56,borderRadius:28,borderWidth:3,
    alignItems:"center",justifyContent:"center"},
  timerNum:{fontSize:20,fontWeight:"900"},
  timerSub:{color:"rgba(255,255,255,0.28)",fontSize:9,fontWeight:"700"},
  timerRound:{color:"rgba(255,255,255,0.22)",fontSize:9},
  scoreRow:{flexDirection:"row",alignItems:"center",
    paddingHorizontal:14,paddingVertical:8,
    backgroundColor:"rgba(0,0,0,0.25)",
    borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,0.05)"},
  scoreItem:{flex:1},
  scoreLbl:{color:"rgba(255,255,255,0.35)",fontSize:10,fontWeight:"700",letterSpacing:.5,marginBottom:2},
  scoreVal:{color:GOLD,fontSize:22,fontWeight:"900"},
  wordArea:{flex:2,alignItems:"center",gap:4},
  wordHint:{color:"rgba(255,255,255,0.35)",fontSize:9,fontWeight:"700",letterSpacing:1},
  wordSecret:{color:GOLD,fontSize:16,fontWeight:"900",letterSpacing:2},
  blanksRow:{flexDirection:"row",gap:4,flexWrap:"wrap",justifyContent:"center"},
  blank:{width:14,height:3,borderRadius:2,backgroundColor:"rgba(255,255,255,0.18)"},
  blankDone:{backgroundColor:GREEN},
  revealWord:{color:GREEN,fontSize:14,fontWeight:"800",marginTop:2},
  canvasWrap:{marginHorizontal:12,marginTop:8,borderRadius:16,overflow:"hidden",
    shadowColor:"#000",shadowOpacity:0.4,shadowRadius:10,elevation:8},
  waitOverlay:{position:"absolute",bottom:8,left:0,right:0,alignItems:"center"},
  waitTxt:{color:"rgba(120,120,140,0.5)",fontSize:12},
  toolbar:{flexDirection:"row",alignItems:"center",
    paddingHorizontal:10,paddingVertical:8,
    backgroundColor:"rgba(0,0,0,0.35)",
    borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.06)",gap:8},
  swatch:{width:28,height:28,borderRadius:14,borderWidth:2,borderColor:"transparent"},
  swatchOn:{borderColor:"#fff",transform:[{scale:1.18}]},
  brushRow:{flexDirection:"row",alignItems:"center",gap:4},
  brushBtn:{width:30,height:30,alignItems:"center",justifyContent:"center",borderRadius:8},
  brushBtnOn:{backgroundColor:"rgba(255,255,255,0.15)"},
  clearBtn:{marginLeft:4,padding:4},
  chat:{flex:1,paddingHorizontal:12,paddingTop:6,maxHeight:110},
  chatSys:{color:"rgba(255,255,255,0.20)",fontSize:11,textAlign:"center",marginBottom:4},
  msgRow:{flexDirection:"row",alignItems:"flex-end",gap:6},
  msgAva:{width:24,height:24,borderRadius:8,alignItems:"center",justifyContent:"center"},
  msgAvaLet:{color:"#fff",fontSize:10,fontWeight:"700"},
  bubble:{maxWidth:"75%",paddingHorizontal:11,paddingVertical:7,borderRadius:13},
  bubbleOther:{backgroundColor:"rgba(255,255,255,0.08)",borderBottomLeftRadius:3},
  bubbleMe:{backgroundColor:"rgba(108,99,255,0.45)",borderBottomRightRadius:3},
  bubbleOk:{backgroundColor:"rgba(0,230,118,0.14)",borderWidth:1,borderColor:"rgba(0,230,118,0.4)"},
  bubbleTxt:{color:"#fff",fontSize:13},
  inputRow:{flexDirection:"row",gap:8,
    paddingHorizontal:12,paddingVertical:10,
    backgroundColor:"rgba(0,0,0,0.3)",
    borderTopWidth:1,borderTopColor:"rgba(255,255,255,0.05)"},
  input:{flex:1,backgroundColor:"rgba(255,255,255,0.07)",
    borderWidth:1,borderColor:"rgba(255,255,255,0.10)",
    borderRadius:22,paddingHorizontal:16,paddingVertical:10,
    color:"#fff",fontSize:13},
  sendBtn:{backgroundColor:PURPLE,borderRadius:22,
    paddingHorizontal:18,paddingVertical:10,
    alignItems:"center",justifyContent:"center"},
  sendTxt:{color:"#fff",fontSize:18,fontWeight:"700"},
  resultCard:{position:"absolute",bottom:0,left:0,right:0,
    backgroundColor:"#1A1830",borderTopWidth:2,borderTopColor:PURPLE,
    padding:20,alignItems:"center",gap:12},
  resultTitle:{color:"rgba(255,255,255,0.7)",fontSize:14,textAlign:"center"},
  resultWord:{color:GOLD,fontSize:24,fontWeight:"900",letterSpacing:2},
  nextBtn:{backgroundColor:PURPLE,borderRadius:22,
    paddingHorizontal:28,paddingVertical:13,
    shadowColor:PURPLE,shadowOpacity:0.5,shadowRadius:10,elevation:6},
  nextTxt:{color:"#fff",fontSize:15,fontWeight:"700"},
});