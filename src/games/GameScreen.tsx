import React,{useEffect,useState}from"react";
import{
  View,Text,StyleSheet,TouchableOpacity,
  ActivityIndicator,ScrollView,
}from"react-native";
import{NativeStackScreenProps}from"@react-navigation/native-stack";
import{RootStackParamList}from"../models/types";
import{GameDoc,listenGame,joinGameAsPlayer2}from"./gameService";
import{useAuth}from"../services/AuthContext";
import{ConnectFour}from"./ConnectFour";
import{TicTacToe}from"./TicTacToe";
import{Battleship}from"./Battleship";
import{Checkers}from"./Checkers";
import{Ludo}from"./Ludo";
import{Uno}from"./Uno";
import{Drawing}from"./Dessin deviné";

type Props=NativeStackScreenProps<RootStackParamList,"GameScreen">;

const LABELS:Record<string,string>={
  connect4:"4 à la suite",tictactoe:"Morpion",
  battleship:"Bataille navale",checkers:"Dames",
  ludo:"Ludo",uno:"UNO",drawing:"Dessin deviné",
};

export function GameScreen({route,navigation}:Props){
  const{chatId,gameId}=route.params;
  const{profile}=useAuth();
  const[game,setGame]=useState<GameDoc|null>(null);

  useEffect(()=>listenGame(chatId,gameId,setGame),[chatId,gameId]);

  useEffect(()=>{
    if(!game||!profile)return;
    const isP1=game.player1===profile.id;
    const isP2=game.player2===profile.id;
    const noP2=!game.player2||game.player2==="";
    if(!isP1&&!isP2&&noP2)joinGameAsPlayer2(chatId,gameId,profile.id);
  },[game?.player2,profile?.id]);

  if(!game||!profile){
    return(
      <View style={s.loading}>
        <ActivityIndicator color="#E8000A" size="large"/>
      </View>
    );
  }

  const noP2=!game.player2||game.player2==="";

  if(noP2){
    return(
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={()=>navigation.goBack()} style={s.back}>
            <Text style={s.backTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>{LABELS[game.type]??game.type}</Text>
          <View style={{width:36}}/>
        </View>
        <View style={s.waiting}>
          <Text style={s.waitEmoji}>⏳</Text>
          <Text style={s.waitTxt}>En attente de l'adversaire...</Text>
          <Text style={s.waitSub}>Dis-lui d'ouvrir la bulle de jeu dans le chat</Text>
        </View>
      </View>
    );
  }

  const props={game,chatId,myId:profile.id};

  const renderGame=()=>{
    switch(game.type){
      case"connect4":return<ConnectFour{...props}/>;
      case"tictactoe":return<TicTacToe{...props}/>;
      case"battleship":return<Battleship{...props}/>;
      case"checkers":return<Checkers{...props}/>;
      case"ludo":return<Ludo{...props}/>;
      case"uno":return<Uno{...props}/>;
      case"drawing":return<Drawing{...props}/>;
      default:return null;
    }
  };

  // UNO et Dessin ont besoin de flex:1 sans ScrollView
  const needsFullscreen=game.type==="uno"||game.type==="drawing";

  return(
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={s.back}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>{LABELS[game.type]??game.type}</Text>
        <View style={{width:36}}/>
      </View>
      {needsFullscreen?(
        <View style={{flex:1}}>{renderGame()}</View>
      ):(
        <ScrollView contentContainerStyle={s.content}>{renderGame()}</ScrollView>
      )}
    </View>
  );
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:"#0a0a0a"},
  loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#0a0a0a"},
  header:{
    paddingTop:54,paddingHorizontal:14,paddingBottom:12,
    flexDirection:"row",alignItems:"center",justifyContent:"space-between",
    backgroundColor:"#1a1a1a",borderBottomWidth:1,borderBottomColor:"#333",
  },
  back:{width:36,height:36,alignItems:"center",justifyContent:"center"},
  backTxt:{color:"#fff",fontSize:28,fontWeight:"300"},
  title:{color:"#fff",fontSize:18,fontWeight:"700"},
  content:{flexGrow:1,alignItems:"center",justifyContent:"center"},
  waiting:{flex:1,alignItems:"center",justifyContent:"center",gap:12},
  waitEmoji:{fontSize:48},
  waitTxt:{color:"#fff",fontSize:16,fontWeight:"600"},
  waitSub:{color:"#888",fontSize:13,textAlign:"center",paddingHorizontal:32},
});