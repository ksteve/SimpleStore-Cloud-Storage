// Author:
// Desc: This file contains the main UI manipulation logic

// Set the $.request host
$.request.host = "http://localhost:1337";

var archiver = require('archiver');
    
var app = angular.module('app', []);
var disableUpload = false;

app.controller('MainController', function($scope, $compile) {
    $("#delete").click(function(){
        deleteSelectedItems();
    })
    
    function deleteSelectedItems(){
        if(confirm("Are you sure?")){
            $(".workingItem:not(.secondary)").each(function(){
                var el = $(this);
                var path = el.attr("path");
                var col = $(this).closest(".fileColumn");
                var colIndex = col.index();
                var folder = columnStack[colIndex];
                var item = findItemByPath(folder,path);

                // [ Remove from tree object ]
                item.parent.children.splice(item.parent.children.indexOf(item),1);

                // [ remove all the elements from the DOM ]
                $("tree-item[path='" + item.path.replace(/'/g,"\\'") + "']").remove();                    

            });

            $("#selectionTools").hide();

        }
    }     
    
    (function contextMenuEvents(){
        $.contextMenu({
            // define which elements trigger this menu
            selector: "tree-item",
            // define the elements of the menu
            items: {
                renameItem: {name: "Rename", callback: function(key, opt){ 
                    
                    // [ Hide all the old textboxes ]
                    $("tree-item").removeClass("editing");      
                    
                    var el = $(this);
                    el.addClass("editing");
                    
                    var textbox = el.children(".itemContainer").children(".itemNameContainer").find(".newName");
                    textbox.focus();
                    textbox[0].select();
                }},
                deleteItem: {name: "Delete", callback: function(key, opt){ 
//                    var el = $(this);
//                    var path = el.attr("path");
//                    var col = $(this).closest(".fileColumn");
//                    var colIndex = col.index();
//                    var folder = columnStack[colIndex];
//                    
//                    var item = findItemByPath(folder,path);
//                    
//                    // [ Remove from tree object ]
//                    item.parent.children.splice(item.parent.children.indexOf(item),1);
//                    
//                    // [ remove all the elements from the DOM ]
//                    $("tree-item[path='" + item.path.replace(/'/g,"\\'") + "']").remove();
                    
                    deleteSelectedItems();
                }},
                downloadItem: {name: "Download", callback: function(key, opt){ 
                    
                }},
            }
        });  
        
        $.contextMenu({
            // define which elements trigger this menu
            selector: ".fileColumn",
            // define the elements of the menu
            items: {
                uploadFiles: {name: "Upload File(s)", callback: function(key, opt){
                    if (disableUpload){
                        return;
                    }

                    // [ Remove the old file input ]
                    $("#fileInput").remove();
                    disableUpload = true;

                    // Get current folder
                    var col = $(this);
                    var colIndex = col.closest(".fileColumnHolder").index();
                    var folder = columnStack[colIndex];
                    
                    // [ Add the new input ]
                    var input = $('<input id="fileInput" style="display:none;" type="file" multiple />');
                    $("body").append(input);
                    
                    // [ Add event listener for when user selects files or folders ]
                    input.change(function(){
                        
                        var files = $(this).get(0).files;

                        if (files.length > 0){
                            // One or more files selected, process the file upload
                            
                            // create a FormData object which will be sent as the data payload in the
                            // AJAX request
                            var formData = new FormData();

                            // loop through all the selected files
                            for (var i = 0; i < files.length; i++) {
                                var file = files[i];

                                filename = file.name;
                                if (files.length == 1){
                                    var filename = prompt("Please enter new filename", file.name);
                                }

                                // add the files to formData object for the data payload
                                formData.append('uploads[]', file, filename);
                            }

                            console.log('Trying to upload:');
                            console.log(formData);

                            $.request("POST","/upload", formData, folder.path).done(function(files){
                                console.log('Upload done');
                                disableUpload = false;
                                
                                // [ Add all the files ]
                                for(var i = 0; i < files.length; i++){
                                    folder.children.push(files[i]);
                                    
                                    
                                    var el = $("<tree-item></tree-item>");
                                    
                                    var attrs = getAttrsFromData(files[i]);
                                    el.attr(attrs);
                                
                                    // [ Append to all the other open folders ]
                                    var folders = $("tree-item[path='" + folder.path.replace(/'/g,"\\'") + "']");
                                    folders.each(function(){
                                        var clone = el.clone();
                                        $(this).append(clone);
                                        
                                        $compile(clone)($scope);
                                    });
                                    
                                    // [ Append to column ]
                                    col.append(el);
                                    $compile(el)($scope);
                                }

                            }).fail(function(root){
                                console.log('Upload failed');
                                disableUpload = false;

                            });
                        }else{
                            // Nothing was selected OR cancel
                            disableUpload = false;
                        }
                    })
                    
                    // [ Trigger the input being clicked ]
                    input.click();
                }},
                uploadFolder: {name: "Upload Folder", callback: function(key, opt){ 
                    if (disableUpload){
                        return;
                    }

                    // [ Remove the old file input ]
                    $("#fileInput").remove();
                    
                    // [ Add the new input ]
                    var input = $('<input id="fileInput" style="display:none;" type="file" webkitdirectory mozdirectory msdirectory odirectory directory multiple />');
                    $("body").append(input);
                    
                    // [ Add event listener for when user selects files or folders ]
                    input.change(function(){
                        var folder = this.get(0).folders;

                        var output = file_system.createWriteStream('target.zip');
                        var archive = archiver('zip');

                        output.on('close', function () {
                            console.log(archive.pointer() + ' total bytes');
                            console.log('archiver has been finalized and the output file descriptor has closed.');
                        });

                        archive.on('error', function(err){
                            throw err;
                        });

                        archive.pipe(output);
                        archive.bulk([
                            { expand: true, cwd: 'source', src: ['**'], dest: 'source'}
                        ]);
                        archive.finalize();
                    })
                    
                    // [ Trigger the input being clicked ]
                    input.click();
                }},
                newFolder: {name: "New Folder", callback: function(key, opt){ 
                    var col = $(this);
                    var colIndex = col.closest(".fileColumnHolder").index();
                    var folder = columnStack[colIndex];

                    var item = {
                         isFolder:true
                        ,isFile:false
                        ,name:"Unnamed"
                        ,children:[]
                        ,new:true
                    }
                    
                    // [ Change the path ]
                    // Use a random forbidden path to ensure uniqueness
                    if(folder.path == "/"){
                        item.path = "/     ";
                    }else{
                        item.path = folder.path + "/     ";
                    }         
                    
                    var el = $("<tree-item></tree-item>");
                    el.addClass("editing");

                    
                    var attrs = getAttrsFromData(item);
 
                    // [ Don't need the following attributes ]
                    delete attrs.children;                     
                    
                    el.attr(attrs);
                    col.append(el);
                    
                    // [ Add item to each open folder ]
                    var els = $(".fileColumn").not(col).find("tree-item[path='" + folder.path.replace(/'/g,"\\'") + "']");
                    els.each(function(){
                        var clone = el.clone();
                        var folder = $(this);
                        folder.children(".itemContainer").children(".children").append(clone);
                        
                        // [ Compile the item ]
                        $compile(clone)($scope);                        
                    }) 
                    
                    
                    // [ Compile the item ]
                    $compile(el)($scope);
                    
                    setTimeout(function(){
                        var textbox = el.children(".itemContainer").children(".itemNameContainer").find(".newName");
                        textbox.focus();
                        textbox[0].select();                        
                    },1);
                    
                    // [ Add item to folder object ]
                    folder.children.push(item);

                    
                }}
            }
        });       
        
        
        $("body").on("keydown",".newName",function(e){
            if(e.keyCode == 13){
                // [ Get new name ]
                var newName = $(this).val();
                // todo: validate that newName is a valid fileName
            
                
                // [ Get Fil ePath ]
                var el = $(this).closest("tree-item");
                var path = el.attr("path");
                
                // [ Get Column ]
                var col = $(this).closest(".fileColumn");
                var colIndex = col.index();
                
                // [ Get File Info ]
                var folder = columnStack[colIndex];
                var item = findItemByPath(columnStack[colIndex],path,true);
                var parent = item.parent;
                
                // [ Change file info ]
                item.name = newName;
                
                // [ Change the path ]
                if(parent.path == "/"){
                    item.path = "/" + newName;
                }else{
                    item.path = parent.path + "/" + newName;
                }            
                
                if(item.new && item.isFolder){
                    var data = {
                        path:item.path
                    };
                    
                    $.request("POST","/folders",data).done(function(){
                        
                    }).fail(function(){
                        alert("Folder creation failed");
                    });
                }
                
                // [ Not new anymore ]
                delete item.new;
                
                // [ Update UI with new name ]
                var els = $("tree-item[path='" + path.replace(/'/g,"\\'") + "']");
                els.each(function(){
                    var el = $(this);
                    el.attr("name",item.name);
                    el.attr("path",item.path);
                    el.children(".itemContainer").children(".itemNameContainer").find(".name").text(newName);
                })

                
                // [ Hide all the textboxes ]
                $("tree-item").removeClass("editing");
                
            }
        })
    })();
    
    function findItemByPath(folder,path){
        var children = [];
        if($.isArray(folder)){
            children = folder;
        }else{
            children = folder.children;
        }
        
        for(var i = 0; i < children.length; i++){
            var item = {};
            if(path == children[i].path){
                item = children[i];
                
                item.parent = folder;
                return item;
            }

            if(item = findItemByPath(children[i],path)){
                return item;
            }
        }                

        return false;
    }
    
    function getAttrsFromData(data){
        var attrs = $.extend({},data);
        for(var key in attrs){
            var newKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
            if(newKey != key){
                attrs[newKey] = attrs[key];
                delete attrs[key];                
            }
            
            if($.isArray(attrs[newKey]) || $.isPlainObject(attrs[newKey])){
                delete attrs[newKey];
            }
        }
        
        return attrs;
    }
    
    function createTreeItem(item,parent){

        var el = $("<tree-item></tree-item>");

        var attrs = getAttrsFromData(item);

        // Don't need the following attributes
        delete attrs.children; 

        el.attr(attrs);

        parent.append(el);

        for(var i = 0; i < item.children.length; i++){
            createTreeItem(item.children[i],el);
        } 

        return el;
    }
    
    // Stack of column data from right to left
//    var columnStack = [];
    window.columnStack = [];
    
    function renderFilesScreen(){
        
        // [ Sample File Tree ]
        
        $.request("GET","/files").done(function(root){
            var colHolder = $("<div class='fileColumnHolder'></div>");
            var newCol = $("<div class='fileColumn'></div>");
            colHolder.append(newCol);
            $("#fileColumnHolder").append(colHolder);
            newCol.append("<div class='fileColumnHeader'>/</div>");

            columnStack.push(root);
            $.each(root.children, function(i,item){
                // [ Create and append all the branches ]
                var el = createTreeItem(item,newCol);

                // [ Compile all the branches ]
                $compile(el)($scope);

            });
        });
        
        // - This is an example response we would get back from GET /files
//        var root = {
//             isFolder:true
//            ,isFile:false
//            ,name:""
//            ,path:"/"
//            ,children:[
//                {
//                     isFolder:true
//                    ,isFile:false
//                    ,name:"Work"
//                    ,path:"/Work"
//                    ,children:[
//                        {
//                             isFolder:false
//                            ,isFile:true
//                            ,name:"myfile.txt"
//                            ,path:"/Work/myfile.txt"
//                            ,children:[]
//                        },
//                        {
//                             isFolder:true
//                            ,isFile:false
//                            ,name:"Q1"
//                            ,path:"/Work/Q1"
//                            ,children:[
//                                {
//                                     isFolder:false
//                                    ,isFile:true
//                                    ,name:"myspreadsheet.xls"
//                                    ,path:"/Work/Q1/myspreadsheet.xls"
//                                    ,children:[]
//                                }
//                            ]
//                        }
//                    ]
//                },
//                {
//                     isFolder:true
//                    ,isFile:false
//                    ,name:"School"
//                    ,path:"/School"
//                    ,children:[]
//
//                },
//                {
//                     isFolder:true
//                    ,isFile:false
//                    ,name:"Taxes"
//                    ,path:"/Taxes"
//                    ,children:[]
//                }
//            ]
//        };
        

        
        
    }
    
    (function filesEvents(){
        // [ Toggle tree branch ]
        $("#filesScreen").on("click","tree-item .arrow",function(e){
            var item = $(this).closest("tree-item");
            item.toggleClass("expanded");
            item.children(".itemContainer").children(".children").slideToggle("fast");
        });
        
        // [ Close columns when empty column space is clicked ]
        $("#filesScreen").on("click",".fileColumnHolder",function(e){
            if($(e.target).closest("tree-item").length > 0) return;
            var currCol = $(this);
            var colIndex = currCol.index();
            
            // [ Remove all the old columns from the column stack ]
            for(var i = columnStack.length; i > colIndex; i--){
                columnStack.splice(i,1);
            }
            
             // [ Create the new column and delete any extra ones ]
            currCol.nextAll().animate({ width: 'toggle' },200,function(){
                $(this).remove();
            })
            currCol.find(".itemNameContainer").removeClass("selected");
            
            // [ Unselect working item ]
            $(".workingItem").removeClass("workingItem").removeClass("secondary");
            
            // [ Hide selection specific tools to declutter workspace ]
            $("#selectionTools").hide();
            
        })
        
        // [ Open new column when tree-item is clicked ]
        $("#filesScreen").on("click","tree-item .itemNameContainer",function(e){
            // [ Don't expand if clicking arrow or textbox ]
            if($(e.target).closest(".arrow").length > 0) return;
            if($(e.target).closest(".newName").length > 0) return;
            
            var name = $(this).closest("tree-item").attr("name");
            var path = $(this).closest("tree-item").attr("path");
            var parent = $(this).closest(".fileColumnHolder");
            var colIndex = parent.index();
            var currCol = $(".fileColumnHolder").eq(colIndex);
            
            // [ Add text highlight ]
            if(!e.shiftKey){
                $(".workingItem").removeClass("workingItem").removeClass("secondary");
            }
            
            $("tree-item[path='" + path.replace(/'/g,"\\'") + "']").addClass("workingItem").addClass("secondary");
            $(this).closest("tree-item").removeClass("secondary");
            
            // [ Show selection specific tools ]
            $("#selectionTools").show();
            
            // [ Update the selected files list ]
            $("#selectedFilesHolder").empty();
            $(".workingItem:not(.secondary)").each(function(){
                var name = $(this).attr("name");
                $("#selectedFilesHolder").append(
                    "<div class='selectedFile'>" + 
                        "<img class='folder' src='img/icons/folder.png'/>" + 
                        "<span class='selectedFileName'>" + name + "</span>" +
                    "</div>"
                );
            })
            

            // [ Don't try to open a file as if it's a folder ]
            if($(this).closest("tree-item").attr("is-folder") == "false") return;
            
            // [ Create the new column and delete any extra ones ]
            currCol.nextAll().remove();
            
            var colHolder = $("<div class='fileColumnHolder'>");
            var newCol = $("<div class='fileColumn'></div>");
            colHolder.append(newCol);
            $("#fileColumnHolder").append(colHolder);
            
            // [ Append the header ]
            newCol.append("<div class='fileColumnHeader'>" + path.replace(/\//g," / ") + "</div>");
            
            var oldLength = columnStack.length;
            
            // [ Remove all the old columns from the column stack ]
            for(var i = columnStack.length; i > colIndex; i--){
                columnStack.splice(i,1);
            }
            
            // [ Add the new column to the column stack ]
            var folder = columnStack[colIndex];
            var newFolder = findItemByPath(folder,path);
            columnStack.push(newFolder);    

            var newLength = columnStack.length;
            
            if(newLength > oldLength){
                colHolder.animate({ width: 'toggle' },0,"linear", function(){
                    colHolder.animate({ width: 'toggle' },200); 
                });
               
            }
            
            // [ Add the item elements to column ]
            $.each(newFolder.children, function(i,item){
                // [ Create and append all the branches ]
                var el = createTreeItem(item,newCol);

                // [ Compile all the branches ]
                $compile(el)($scope);
                
            })            
            
            // [ Highlight the selected folder ]
            currCol.find(".itemNameContainer").removeClass("selected");
            $(this).closest(".itemNameContainer").addClass("selected");
            
            
        })
    })();

    (function loginEvents(){
        
        // [ Login user ]
        $("#login").click(function(){
            var credentials = {};
            credentials.username = $("#username").val();
            credentials.password = $("#password").val();
            
            $.request("POST","/token",credentials).done(function(data){
                $.request.token = data.token;
                
                expandWindow();
            }).fail(function(data){
                alert(data.message);
            })
            

        });       
    
        // [ Toggle Signup UI ]
        $("#openSignUp,#openLogIn").click(function(){
            $("#signupUI").toggle();
            $("#login").toggle();
            $("#signUpMessage").toggle();
            $(".extraFieldContainer").slideToggle("fast");
        });
        
        $("#signup").click(function(){
            var credentials = {};
            credentials.username = $("#username").val();
            credentials.password = $("#password").val();
            credentials.confirmPassword = $("#confirmPassword").val();
            credentials.signup = true;
            
            $.request("POST","/token",credentials).done(function(data){
                $.request.token = data.token;
                
                expandWindow();
            }).fail(function(data){
                alert(data.message);
            })           
        })
        
        function expandWindow(){
            var w = $(window).width();
            var h = $(window).height();

            $("#loginScreen").fadeToggle("fast",function(){
                $("#filesScreen").fadeToggle("fast");
                renderFilesScreen();
            });

            var currentCenterX = window.screenX + $(window).width() / 2;
            var currentCenterY = window.screenY + $(window).height() / 2;
            var lastWidth = w;
            var lastHeight = h;
            $({ t:0 }).animate({ t: 1},{
                 duration:300
                ,step:function(t){
                    var newWidth = w + t*(950 - w);
                    var newHeight = h + t*(650 - h);
                    var deltaWidth = newWidth - lastWidth;
                    var deltaHeight = newHeight - lastHeight;

                    // This is pretty laggy:
    //                    window.moveTo(window.screenX - deltaWidth/2, window.screenY - deltaHeight/2);
                    window.resizeTo(newWidth, newHeight);

                    lastWidth = newWidth;
                    lastHeight = newHeight;
                }
            })           
        }
    })();
 
});

// [ Async load all the components ]
// - Declutters the head tag in index.html
// - App loads faster
(function(){
	var comps = [
		 "tree-item"
	];

	$.each(comps,function(i,name){
		$("body").append("<link rel='stylesheet' type='text/css' href='comps/" + name + "/styles.css'></link>");
	});

	$.each(comps,function(i,name){
		$("body").append("<script src='comps/" + name + "/script.js'></script>");
	});
})();
