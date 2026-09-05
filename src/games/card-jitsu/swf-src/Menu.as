import flash.external.ExternalInterface;

class Menu {
    static var app:Menu;

    private var root:MovieClip;
    private var menus:MovieClip;
    private var sensei:MovieClip;
    private var options:MovieClip;
    private var speech:MovieClip;
    private var howtoplay:MovieClip;

    public var hasCards:Boolean;
    public var introSeen:Boolean;

    static function main(root:MovieClip):Void {
        app = new Menu(root);
    }

    function Menu(root:MovieClip) {
        this.root = root;
        root.stop();
        init();
    }

    private function init():Void {
        menus = root.menus;
        if (menus == undefined) {
            menus = root;
        }

        sensei = menus.sensei;
        options = menus.options;
        speech = menus.speech;
        howtoplay = menus.howtoplay;

        menus.gotoAndStop(1);

        // Parameters from FlashVars or host environment
        var scope:MovieClip = (_root.introSeen != undefined) ? _root : root;

        introSeen = toBool(scope.introSeen);
        hasCards = toBool(scope.hasCards) || introSeen;

        // Populate global SHELL mock with isItemInMyInventory(821)
        var SHELL:Object = _global.SHELL;
        if (SHELL == undefined) {
            SHELL = {};
            _global.SHELL = SHELL;
        }
        var self:Menu = this;
        SHELL.isItemInMyInventory = function(id:Number):Boolean {
            if (id == 821) return self.hasCards;
            return false;
        };
        SHELL.getMyInventoryArray = function():Array {
            if (self.hasCards) return [821];
            return [];
        };

        ExternalInterface.addCallback("showMainMenu", this, showMainMenu);
        ExternalInterface.addCallback("showIntro", this, showIntro);
        ExternalInterface.addCallback("setIntroState", this, function(intro:Boolean, cards:Boolean):Void {
            self.introSeen = intro;
            self.hasCards = (cards || intro);
            if (self.hasCards) {
                self.showMainMenu();
            } else {
                self.showIntro();
            }
        });

        // If player has not seen intro or lacks starter deck 821, start first-login sequence
        if (!SHELL.isItemInMyInventory(821)) {
            showIntro();
        } else {
            showMainMenu();
        }
    }

    private function toBool(val:Object):Boolean {
        return val == true || val == 1 || val == "true" || val == "1";
    }

    private function setSenseiAnim(frame:String):Void {
        if (sensei != undefined) {
            sensei.gotoAndStop(frame);
        }
    }

    private function setSpeech(text:String):Void {
        if (speech != undefined && speech.message != undefined) {
            speech._visible = true;
            speech.message.text = text;
        }
    }

    private function setOption(item:MovieClip, label:String, cb:Function):Void {
        if (item == undefined) return;
        item._visible = true;
        if (item.label != undefined) {
            item.label.text = label;
        }
        item.useHandCursor = true;
        item.onRelease = cb;
    }

    private function hideOption(item:MovieClip):Void {
        if (item != undefined) {
            item._visible = false;
        }
    }

    private function setHowToPlay(frame:String, visible:Boolean):Void {
        if (howtoplay != undefined) {
            howtoplay._visible = visible;
            if (visible && frame != undefined) {
                howtoplay.gotoAndStop(frame);
            }
        }
    }

    /**
     * State 0: Intro sequence for first-time login
     */
    public function showIntro():Void {
        setSenseiAnim("talk");
        setHowToPlay(null, false);
        setSpeech("Greetings, grasshopper. Welcome to the Dojo.\nI am Sensei, master of Card-Jitsu.");

        var self:Menu = this;
        setOption(options.item1, "I am ready for my cards", function():Void {
            self.grantStarterDeck();
        });
        setOption(options.item2, "What is Card-Jitsu?", function():Void {
            self.showCardJitsuOverview();
        });
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * State 1: Overview of Card-Jitsu elements
     */
    public function showCardJitsuOverview():Void {
        setSenseiAnim("point");
        setHowToPlay("belt", true);
        setSpeech("Card-Jitsu is the ancient art of elements. Fire melts snow, snow freezes water, and water extinguishes fire.");

        var self:Menu = this;
        setOption(options.item1, "Give me my cards", function():Void {
            self.grantStarterDeck();
        });
        setOption(options.item2, "Tell me more", function():Void {
            self.showTutorial();
        });
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * State 2: Starter deck grant & onboarding
     */
    public function grantStarterDeck():Void {
        hasCards = true;
        introSeen = true;

        // Notify host JavaScript to update server D1 state
        ExternalInterface.call("onIntroComplete");

        setSenseiAnim("point");
        setHowToPlay(null, false);
        setSpeech("Here is your starter deck of 12 cards. Train diligently and your ninja skills will grow, grasshopper.");

        var self:Menu = this;
        setOption(options.item1, "How do I win?", function():Void {
            self.showTutorial();
        });
        setOption(options.item2, "Enter the Dojo", function():Void {
            self.showMainMenu();
        });
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * State 3: Authentic in-engine tutorial
     */
    public function showTutorial():Void {
        setSenseiAnim("talk");
        setHowToPlay("belt", true);
        setSpeech("Win by collecting three cards of the same element in different colors, or one card of each element: fire, water, snow.");

        var self:Menu = this;
        setOption(options.item1, "I understand. Let's play!", function():Void {
            self.showMainMenu();
        });
        setOption(options.item2, "Detailed Guide", function():Void {
            ExternalInterface.call("onMenuSelect", "instructions");
        });
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * State 4: Standard main menu
     */
    public function showMainMenu():Void {
        setSenseiAnim("wait");
        setHowToPlay(null, false);
        setSpeech("Do you wish to play and compete with another student, grasshopper?");

        var self:Menu = this;
        setOption(options.item1, "Earn your belts", function():Void {
            ExternalInterface.call("onMenuSelect", "belts");
        });
        setOption(options.item2, "Challenge Sensei", function():Void {
            ExternalInterface.call("onMenuSelect", "sensei");
        });
        setOption(options.item3, "Instructions", function():Void {
            self.showTutorial();
        });
        hideOption(options.item4);
    }
}

