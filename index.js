var superagent = require('superagent');  
var cheerio = require('cheerio');  
var async = require('async');

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
        async.mapLimit(heroes,5, 
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
                    console.log(JSON.stringify(hero));
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
        .get(heroUrl)
        .end(function(err, res){  
            if(err){
                console.log("fail");
                concurrencyCount--;
                var hero = {
                    succ:false
                }
                //callback左边的参数为error的string，不为null时会打断本次map
                callback(null,hero);
            }else{
                // 获取爬到的角色详细页面内容
                var $ = cheerio.load(res.text,{decodeEntities: false});  
                var heroTitle = $('.hero-title').first().text();
                var heroName = $('.hero-name').first().text();
                var heroType = $('.hero-tag').first().text()+" "+$('.hero-tag').last().text();
                console.log('找到英雄:'+heroTitle+" "+heroName+"|"+heroType);
                concurrencyCount--;
                var hero = {
                    succ:true,
                    title:heroTitle,
                    name:heroName,
                    type:heroType
                }
                //callback后才会结束此并行“线程”
                callback(null, hero);
            }
        });
}