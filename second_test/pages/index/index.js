// index.js
Page({
  data:{
    message:"Hello World",
    flag:0
  },
  changeText(){
    if(this.data.flag == 0){
      this.setData({
        flag:1,
        message:"Hello WeChat"
      })
    }
    else{
      this.setData({
        flag:0,
        message:"Hello World"
      })
    }
  }
})
