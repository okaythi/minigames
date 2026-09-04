import flash.external.ExternalInterface;

class Bootstrap {
    static var app:Bootstrap;

    static function main(root:MovieClip):Void {
        app = new Bootstrap(root);
    }

    static function wrap(obj:Object, name:String, fn:Function):Void {
        obj[name] = function() {
            var safeArgs:Array = [];
            for (var i:Number = 0; i < arguments.length; i++) {
                var arg:Object = arguments[i];
                var t:String = typeof(arg);
                if (t == "string" || t == "number" || t == "boolean") {
                    safeArgs.push(arg);
                } else if (t == "function") {
                    safeArgs.push("[Function]");
                } else if (arg instanceof Array) {
                    safeArgs.push("[Array:" + arg.length + "]");
                } else {
                    safeArgs.push("[Object]");
                }
            }
            ExternalInterface.call("shimLog", name, safeArgs);
            return fn.apply(this, arguments);
        };
    }

    static function trap(obj:Object, label:String):Void {
        obj.__resolve = function(name:String) {
            ExternalInterface.call("shimLog", "MISSING", label + "." + name);
            return undefined;
        };
    }

    function Bootstrap(root:MovieClip) {
        var nick:String = (root.nick != undefined) ? String(root.nick) : "Ninja";
        var modeRaw:Object = (root.mode != undefined) ? root.mode : 3;
        var modeNum:Number = (modeRaw == "MODE_SEN" || modeRaw == 3 || modeRaw == "3") ? 3 : ((modeRaw == "MODE_EXP" || modeRaw == 2 || modeRaw == "2") ? 2 : 1);
        var color:Number = (root.color != undefined) ? Number(root.color) : 6;
        var rank:Number = (root.rank != undefined) ? Number(root.rank) : 1;

        var SHELL:Object = {};
        SHELL.GAME_COOKIE = "game_ninja";
        
        Bootstrap.wrap(SHELL, "getCurrentServerRoomId", function():Number { return 100; });
        Bootstrap.wrap(SHELL, "getMyPlayerId", function():Number { return 1001; });
        Bootstrap.wrap(SHELL, "getMyPlayerNickname", function():String { return nick; });
        Bootstrap.wrap(SHELL, "getLocalizedString", function(k:String):String {
            if (k == "sensei_label") return "Sensei";
            return k;
        });
        Bootstrap.wrap(SHELL, "getGameContentPath", function():String { return "/games/card-jitsu"; });
        Bootstrap.wrap(SHELL, "getCookie", function(name:String):Object {
            return { room: 100, mode: modeNum };
        });
        Bootstrap.wrap(SHELL, "getPlayerHexFromId", function(id:Object):Number {
            var n:Number = Number(id);
            switch(n) {
                case 1: return 0x003366;  // Dark Blue
                case 2: return 0x009900;  // Green
                case 3: return 0xFF3399;  // Pink
                case 4: return 0x333333;  // Black
                case 5: return 0xCC0000;  // Red
                case 6: return 0xFF6600;  // Orange
                case 7: return 0xFFCC00;  // Yellow
                case 8: return 0x660099;  // Purple
                case 9: return 0x996600;  // Brown
                case 10: return 0xFF6666; // Peach
                case 11: return 0x006600; // Dark Green
                case 12: return 0x0099CC; // Light Blue
                case 13: return 0x8AE302; // Lime Green
                case 14: return 0x8C8C8C; // Sensei Gray
                default: return 0x003366;
            }
        });
        Bootstrap.wrap(SHELL, "getInventoryObjectById", function(id:Number):Object { return undefined; });
        Bootstrap.wrap(SHELL, "getMyInventoryArray", function():Array { return []; });
        Bootstrap.wrap(SHELL, "isItemInMyInventory", function(id:Number):Boolean { return false; });
        Bootstrap.wrap(SHELL, "sendJoinRoom", function():Void {});
        Bootstrap.wrap(SHELL, "showPrompt", function():Void {});
        Bootstrap.wrap(SHELL, "stopGameMusic", function():Void {
            ExternalInterface.call("stopMusic");
        });

        var AIRTOWER:Object = {};
        AIRTOWER._listeners = {};
        Bootstrap.wrap(AIRTOWER, "addListener", function(action:String, handler:Function, scope:Object):Void {
            if (this._listeners[action] == undefined) this._listeners[action] = [];
            this._listeners[action].push({ h: handler, s: scope });
        });
        Bootstrap.wrap(AIRTOWER, "removeListener", function(action:String, handler:Function):Void {
            var list:Array = this._listeners[action];
            if (list == undefined) return;
            for (var i:Number = list.length - 1; i >= 0; i--) if (list[i].h == handler) list.splice(i, 1);
        });
        Bootstrap.wrap(AIRTOWER, "send", function(ext:String, action:String, args:Array, type:String, roomId:Number):Void {
            ExternalInterface.call("onFlashAirtowerSend", ext, action, args, type, roomId);
        });

        var INTERFACE:Object = {};
        Bootstrap.wrap(INTERFACE, "sendScore", function(s:Number):Void { ExternalInterface.call("onFlashGameScore", s); });
        Bootstrap.wrap(INTERFACE, "showPrompt", function():Void {});

        var ENGINE:Object = {};

        Bootstrap.trap(SHELL, "SHELL");
        Bootstrap.trap(AIRTOWER, "AIRTOWER");
        Bootstrap.trap(INTERFACE, "INTERFACE");
        Bootstrap.trap(ENGINE, "ENGINE");

        _global.SHELL = SHELL;
        _global.AIRTOWER = AIRTOWER;
        _global.INTERFACE = INTERFACE;
        _global.ENGINE = ENGINE;
        _global.getCurrentShell = function():Object { return _global.SHELL; };
        _global.getCurrentAirtower = function():Object { return _global.AIRTOWER; };
        _global.getCurrentInterface = function():Object { return _global.INTERFACE; };
        _global.getCurrentEngine = function():Object { return _global.ENGINE; };

        if (_global.com == undefined) _global.com = {};
        if (_global.com.clubpenguin == undefined) _global.com.clubpenguin = {};
        if (_global.com.clubpenguin.security == undefined) _global.com.clubpenguin.security = {};
        _global.com.clubpenguin.security.Security = { doSecurityCheck: function():Boolean { return true; } };

        ExternalInterface.addCallback("dispatchAirtowerMessage", null,
            function(action:String, resObj:Array):Void {
                var list:Array = _global.AIRTOWER._listeners[action];
                if (list == undefined) { ExternalInterface.call("shimLog", "no listener", [action]); return; }
                for (var i:Number = 0; i < list.length; i++) list[i].h.apply(list[i].s, [resObj]);
            });

        ExternalInterface.call("shimLog", "bootstrap ready", [modeNum, nick, color, rank]);

        var loadCardSWF:Function = function():Void {
            var holder:MovieClip = root.createEmptyMovieClip("gameHolder", 1);
            holder._lockroot = true;
            var loader:MovieClipLoader = new MovieClipLoader();
            loader.loadClip(SHELL.getGameContentPath() + "/card.swf", holder);
        };

        var localeHolder:MovieClip = root.createEmptyMovieClip("localeHolder", 2);
        var localeLoader:MovieClipLoader = new MovieClipLoader();
        var localeListener:Object = {};
        localeListener.onLoadInit = function(target:MovieClip):Void {
            var data:Object = {};
            var list:Array = target.localeText;
            if (list != undefined) {
                for (var i:Number = 0; i < list.length; i++) {
                    var item:Object = list[i];
                    if (item != undefined && item.id != undefined) {
                        data[item.id] = item.value;
                    }
                }
            }
            if (_global.com.clubpenguin.util == undefined) _global.com.clubpenguin.util = {};
            _global.com.clubpenguin.util.LocaleText = {
                ready: true,
                dataArray: data,
                getText: function(id:String):String {
                    if (this.dataArray != undefined && this.dataArray[id] != undefined) {
                        return this.dataArray[id];
                    }
                    return id;
                },
                getTextReplaced: function(id:String, replacements:Array):String {
                    var str:String = this.getText(id);
                    if (replacements != undefined) {
                        for (var r:Number = 0; r < replacements.length; r++) {
                            str = str.split("%" + r + "%").join(replacements[r]);
                        }
                    }
                    return str;
                },
                isReady: function():Boolean { return true; },
                getLocaleID: function():Number { return 0; }
            };
            ExternalInterface.call("shimLog", "locale text loaded OK!", list.length);
            loadCardSWF();
        };

        localeListener.onLoadError = function():Void {
            ExternalInterface.call("shimLog", "locale load error, fallback");
            if (_global.com.clubpenguin.util == undefined) _global.com.clubpenguin.util = {};
            _global.com.clubpenguin.util.LocaleText = {
                ready: true,
                dataArray: { sensei_label: "Sensei" },
                getText: function(id:String):String {
                    return (this.dataArray != undefined && this.dataArray[id] != undefined) ? this.dataArray[id] : id;
                },
                isReady: function():Boolean { return true; }
            };
            loadCardSWF();
        };

        localeLoader.addListener(localeListener);
        localeLoader.loadClip(SHELL.getGameContentPath() + "/lang/en/locale.swf", localeHolder);
    }
}
