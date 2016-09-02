var superagent = require('superagent');  
var cheerio = require('cheerio');  
var async = require('async');
var fs= require('fs');
var request = require("request");
var http = require("http");


//判断文件夹是否存在
fs.exists("img/", function(exists) {
    if(!exists){
        fs.mkdirSync("img/");
    }
});

start();

// 第一步，使用superagent发起get请求，获取含有英雄名字的页面
function start(){
    console.log('爬虫程序开始运行......');
    superagent  
    .get('http://lol.duowan.com/hero/')
    .end(function(err, res){          
        // 请求返回后的页面处理，使用cheerio提取英雄
        var $ = cheerio.load(res.text,{decodeEntities: false}); 
        //找到每个英雄的链接，并存入数组，等待并行请求
        var heroes = new Array();
        $("a.lol_champion").each(function(i, e) {
            heroes.push($(e).attr("href"));
        });

        //并发遍历heroes对象
        async.mapLimit(heroes,1,
            function (heroUrl, callback) {
            // 对每个角色对象的处理逻辑
                fetchInfo(heroUrl, callback);
            },
            function (err, result) {
                if(err){
                    console.log("error is:"+err);
                }
                //这里的result就是callback回来的数组
                console.log("抓取结束，共计:"+result.length+"个");
                result.forEach(function(hero){
                    var resultString = JSON.stringify(hero);
                    console.log(resultString);
                });
                //使用fs写出到文件
                fs.writeFile('lol_heroes.json',JSON.stringify(result), function (err) {
                    if (err) throw err;
                    console.log("Export file Success!");
                });
            }
        );
        //串行遍历heroes对象
        // async.mapSeries(heroes,function (heroUrl, callback) {
        //     // 对每个角色对象的处理逻辑
        //         fetchInfo(heroUrl, callback);
        //     }, 
        //     function (err, result) {
        //         if(err){
        //             console.log("error is:"+err);
        //         }
        //         //这里的result就是callback回来的数组
        //         console.log("抓取结束，共计:"+result.length+"个");  
        //         result.forEach(function(hero){  
        //             console.log(JSON.stringify(hero));
        //         });
        //     }
        // );
    }); 
}

// 获取角色信息
var concurrencyCount = 0; // 当前并发数记录  
function fetchInfo(heroUrl, callback){  
    concurrencyCount++;
    console.log("...正在抓取:"+ heroUrl + "...当前并发数记录：" + concurrencyCount);
    // 根据URL，进行详细页面的爬取和解析
    superagent
    //部分URL含有空格,会出现错误,所以trim()下能去掉
        .get(heroUrl.trim())
        .end(function(err, res){  
            if(err){
                console.log("fail");
                concurrencyCount--;
                var hero = {
                    succ:false,
                    url:heroUrl
                }
                //callback左边的参数为error的string，不为null时会打断本次map
                callback(null,hero);
            }else{
                // 获取爬到的角色详细页面内容
                var $ = cheerio.load(res.text,{decodeEntities: false});  
                var heroTitle = $('.hero-title').first().text();
                var heroName = $('.hero-name').first().text();
                var heroType = $('.hero-tag').first().text()+" "+$('.hero-tag').last().text();
                var heroesPicUrlArray = new Array();
                $(".ui-slide__panel img").each(function(i, e) {
                    heroesPicUrlArray.push($(e).attr("src"));
                });
                console.log(heroesPicUrlArray);
                var index = 0;
                async.mapLimit(heroesPicUrlArray,heroesPicUrlArray.length,
                    function (heroesPicUrl, downloadCallback) {
                        // 对每个角色对象的处理逻辑
                        index++;
                        var savePath = 'img/' + heroName + index + ".jpg";
                        download(heroesPicUrl,savePath,downloadCallback);
                    },
                    function (err, result) {
                        if(err){
                            console.log("error is:"+err);
                            finish();
                            return;
                        }
                        //这里的result就是callback回来的数组
                        console.log("下载完成，共计:"+result.length+"个");
                        finish();
                    }
                );

                function download(heroesPicUrl,savePath,downloadCallback){
                    http.get(heroesPicUrl, function(res){
                        var imgData = "";
                        res.setEncoding("binary"); //一定要设置response的编码为binary否则会下载下来的图片打不开
                        res.on("data", function(chunk){
                            imgData += chunk;
                        });
                        res.on("end", function(){
                            fs.writeFile(savePath, imgData, "binary", function(err){
                                if(err){
                                    console.log("save fail:",err);
                                    downloadCallback(null,heroesPicUrl);
                                    return;
                                }
                                console.log("save success");
                                downloadCallback(null,heroesPicUrl);
                            });
                        });
                    });
                }
                function finish(){
                    console.log('找到英雄:'+heroTitle+" "+heroName+"|"+heroType);
                    concurrencyCount--;
                    var hero = {
                        succ:true,
                        title:heroTitle,
                        name:heroName,
                        type:heroType,
                        url:heroUrl
                    }
                    //callback后才会结束此并行“线程”
                    callback(null, hero);
                }
            }
        });
}