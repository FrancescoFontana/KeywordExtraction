var should = require('should');
var cheerio = require('cheerio');
var gramophone = require('gramophone');
var sentimental = require('Sentimental').analyze;
var request = require("request");
var util = require('util');
var jsdom = require('jsdom-nogyp');
var Entities = require('html-entities').XmlEntities;
var entities = new Entities();

analyse('http://www.ig.com/uk/spread-betting');


function analyse(url){
    jsdom.env({
        url : url,
        done : function (errors, window) {
            var document = window.document || {};

            var html = document.innerHTML;

            var analysis = exploreHtml(html);
            console.log(util.inspect(analysis, false, null));
            var links = extractLinks(window);
            extractAllHtml(links,0,[],exploreAndMerge,{analysis:analysis});

        }
    });
}

function exploreHtml(html){
    var $ = cheerio.load(html);

    var text = '';
    $('a, img, span, .footer, #footer, .header, #header, .foot, #foot, .head, #head, script, style, iframe').remove();

    $('title, p, h1, .content, #content').each(function(i, element){
        var t = $(this).text().replace(/(\r\n|\n|\r|\t)/gm," ").replace(/  /gm," ").trim();
        t = entities.decode(t);
        if(t.length > 0){
            text+=' '+t;
        }
    });


    var keywords = gramophone.extract(text, {ngrams: 2, html: true, limit: 5, score: true, stem : true});
    var sentiment = sentimental(text);

    console.log(util.inspect(keywords, false, null));
    console.log(util.inspect(sentiment.score, false, null));
    console.log(util.inspect(sentiment.comparative, false, null));

    return {
        keywords : keywords,
        score : sentiment.score,
        comparative: sentiment.comparative
    };
}

function extractLinks(window){

    var html = window.document.innerHTML;
    var origin = window.location.protocol + '//' + window.location.hostname;
    var href = window.location.href;


    var $ = cheerio.load(html);
    var linkList =  [];

    $('a[href]').each(function(){
        var url = $(this).attr('href');
        if(url.indexOf('#') === 0){
            url = href + url;
        }

        if(url.indexOf('http')!==0){
            url = origin + url;
        }
        linkList.push(url);
    });
    var uniqueLinks = linkList.filter(function(itm,i,linkList){
        return i==linkList.indexOf(itm);
    });

    return uniqueLinks;
}

function extractAllHtml(linkList, i, retObject, callback, options){
    if(i < linkList.length){
        console.log('['+(i+1)+'/'+linkList.length+']','Analysing: '+linkList[i]);
        jsdom.env({
            url : linkList[i],
            done : function (errors, window) {
                if(!!window){
                    var document = window.document || {};

                    retObject.push({
                        href : linkList[i],
                        html : document.innerHTML
                    });
                    extractAllHtml(linkList, i+1, retObject, callback, options);
                }
                else{
                    console.log('Error extracting from ' + linkList[i]);
                    extractAllHtml(linkList, i+1, retObject, callback, options);
                }
            }
        });
    }
    else{
        callback(retObject, options);
    }
}

function exploreAndMerge(htmlList, options){
    htmlList = htmlList || [];
    options = options || {};
    var mainAnalysis = options.analysis || {};
    mainAnalysis.linkedContent = mainAnalysis.linkedContent || [];

    for(var i = 0; i < htmlList.length; i++){
        var htmlPage = htmlList[i];
        var html = htmlPage.html;
        var analysis = exploreHtml(html);
        if(!!analysis && !!analysis.keywords){
            mainAnalysis.linkedContent.push({
                href : htmlPage.href,
                analysis : analysis
            });
        }
    }
    console.log(util.inspect(mainAnalysis, false, null));
}


