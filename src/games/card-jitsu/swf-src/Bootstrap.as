import flash.external.ExternalInterface;

class Bootstrap {
    static var app:Bootstrap;

    static function main(root:MovieClip):Void {
        app = new Bootstrap(root);
    }

    function Bootstrap(root:MovieClip) {
        var SHELL:Object = {};
        SHELL.GAME_COOKIE = "game_ninja";
        SHELL.getCurrentServerRoomId = function():Number { return 100; };
        SHELL.getMyPlayerId = function():Number { return 1001; };
        SHELL.getMyPlayerNickname = function():String { return "Ninja"; };
        SHELL.getLocalizedString = function(k:String):String { return k; };
        SHELL.getGameContentPath = function():String { return "/games/card-jitsu"; };
        SHELL.getCookie = function(name:String):Object {
            var mode:String = (_global.cardJitsuMode != undefined) ? _global.cardJitsuMode : "MODE_EXP";
            return { room: 100, mode: mode };
        };
        SHELL.getPlayerHexFromId = function(id:Number):Number { return (id == 1) ? 0x003366 : 0xCC0000; };
        SHELL.getInventoryObjectById = function(id:Number):Object { return undefined; };
        SHELL.getMyInventoryArray = function():Array { return []; };
        SHELL.isItemInMyInventory = function(id:Number):Boolean { return false; };
        SHELL.sendJoinRoom = function():Void {};
        SHELL.showPrompt = function():Void {};

        var AIRTOWER:Object = {};
        AIRTOWER._listeners = {};
        AIRTOWER.addListener = function(action:String, handler:Function, scope:Object):Void {
            if (this._listeners[action] == undefined) this._listeners[action] = [];
            this._listeners[action].push({ h: handler, s: scope });
        };
        AIRTOWER.removeListener = function(action:String, handler:Function):Void {
            var list:Array = this._listeners[action];
            if (list == undefined) return;
            for (var i:Number = list.length - 1; i >= 0; i--) if (list[i].h == handler) list.splice(i, 1);
        };
        AIRTOWER.send = function(ext:String, action:String, args:Array, type:String, roomId:Number):Void {
            ExternalInterface.call("onFlashAirtowerSend", ext, action, args, type, roomId);
        };

        var INTERFACE:Object = {};
        INTERFACE.sendScore = function(s:Number):Void { ExternalInterface.call("onFlashGameScore", s); };
        INTERFACE.showPrompt = function():Void {};

        var ENGINE:Object = {};

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
                if (list == undefined) { ExternalInterface.call("shimLog", "no listener", action); return; }
                for (var i:Number = 0; i < list.length; i++) list[i].h.apply(list[i].s, [resObj]);
            });

        ExternalInterface.call("shimLog", "bootstrap ready");

        var holder:MovieClip = root.createEmptyMovieClip("gameHolder", 1);
        holder._lockroot = true;
        var loader:MovieClipLoader = new MovieClipLoader();
        loader.loadClip(SHELL.getGameContentPath() + "/card.swf", holder);
    }
}
