import flash.external.ExternalInterface;

class Menu {
    static var app:Menu;

    static function main(root:MovieClip):Void {
        app = new Menu(root);
    }

    function Menu(root:MovieClip) {
        root.stop();
        init(root);
    }

    private function init(root:MovieClip):Void {
        var menus:MovieClip = root.menus;
        if (menus == undefined) {
            menus = root;
        }

        // Frame 1: Sensei dialogue
        menus.gotoAndStop(1);

        // Set authentic dialogue from CP en.txt
        if (menus.speech != undefined && menus.speech.message != undefined) {
            menus.speech.message.text = "Do you wish to play and compete with another student, grasshopper?";
        }

        // Configure interactive menu options
        var opts:MovieClip = menus.options;
        if (opts != undefined) {
            if (opts.item1 != undefined) {
                opts.item1.label.text = "Earn your belts";
                opts.item1.onRelease = function():Void {
                    ExternalInterface.call("onMenuSelect", "belts");
                };
            }

            if (opts.item2 != undefined) {
                opts.item2.label.text = "Challenge Sensei";
                opts.item2.onRelease = function():Void {
                    ExternalInterface.call("onMenuSelect", "sensei");
                };
            }

            if (opts.item3 != undefined) {
                opts.item3.label.text = "Instructions";
                opts.item3.onRelease = function():Void {
                    ExternalInterface.call("onMenuSelect", "instructions");
                };
            }

            if (opts.item4 != undefined) {
                opts.item4._visible = false;
            }
        }
    }
}
