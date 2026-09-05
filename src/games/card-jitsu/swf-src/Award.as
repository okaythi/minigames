import flash.external.ExternalInterface;

class Award {
    static var app:Award;

    static var BELT_COLORS:Array = [
        0,
        0xFFFFFF, // 1 White
        0xFFFF00, // 2 Yellow
        0xFF6600, // 3 Orange
        0x33CC00, // 4 Green
        0x0033CC, // 5 Blue
        0xCC0000, // 6 Red
        0x6600FF, // 7 Purple
        0x663300, // 8 Brown
        0x444444  // 9 Black
    ];

    static var BELT_NAMES:Array = [
        "",
        "White",
        "Yellow",
        "Orange",
        "Green",
        "Blue",
        "Red",
        "Purple",
        "Brown",
        "Black",
        "Ninja Master"
    ];

    private var root:MovieClip;
    private var menus:MovieClip;
    private var sensei:MovieClip;
    private var options:MovieClip;
    private var speech:MovieClip;
    private var howtoplay:MovieClip;

    public var currentRank:Number;

    static function main(root:MovieClip):Void {
        app = new Award(root);
    }

    function Award(root:MovieClip) {
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

        var scope:MovieClip = (_root.rank != undefined) ? _root : root;
        var r:Number = Number(scope.rank);
        if (isNaN(r) || r < 1) {
            r = 1;
        }
        currentRank = r;

        var self:Award = this;
        ExternalInterface.addCallback("playAward", this, function(rankNum:Number):Void {
            self.playAward(rankNum);
        });

        playAward(currentRank);
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

    private function setBeltColor(colorRGB:Number):Void {
        if (howtoplay != undefined) {
            howtoplay._visible = true;
            howtoplay.gotoAndStop("belt");
            var anim:MovieClip = howtoplay.fadeInAnim;
            if (anim != undefined) {
                anim.gotoAndPlay(1);
                var applyColor:Function = function():Void {
                    if (anim.belt != undefined && anim.belt.colour != undefined) {
                        var c:Color = new Color(anim.belt.colour);
                        c.setRGB(colorRGB);
                    }
                };
                applyColor();
                var framesLeft:Number = 8;
                anim.onEnterFrame = function():Void {
                    applyColor();
                    framesLeft--;
                    if (framesLeft <= 0) {
                        delete anim.onEnterFrame;
                    }
                };
            }
        }
    }

    public function playAward(rank:Number):Void {
        currentRank = rank;
        if (rank >= 10) {
            showDefeatSenseiIntro();
        } else {
            showBeltEarned(rank);
        }
    }

    /**
     * Standard belt ceremony: Step 1 - Congratulations & belt showcase
     */
    public function showBeltEarned(rank:Number):Void {
        setSenseiAnim("point");
        setBeltColor(BELT_COLORS[rank]);
        setSpeech("Congratulations, grasshopper. You have earned your belt!");

        var self:Award = this;
        setOption(options.item1, "OK", function():Void {
            self.showBeltRank(rank);
        });
        hideOption(options.item2);
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * Standard belt ceremony: Step 2 - Belt rank title & Return to Dojo
     */
    public function showBeltRank(rank:Number):Void {
        setSenseiAnim("talk");
        setHowToPlay("belt", true);

        var name:String = (rank >= 1 && rank < BELT_NAMES.length) ? BELT_NAMES[rank] : "new";
        setSpeech("You are now a " + name + " belt.");

        var self:Award = this;
        setOption(options.item1, "Return to Dojo", function():Void {
            self.completeAward();
        });
        hideOption(options.item2);
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * Ninja Master ceremony: Step 1 - Sensei defeated
     */
    public function showDefeatSenseiIntro():Void {
        setSenseiAnim("talk");
        setHowToPlay(null, false);
        setSpeech("You have bested me, grasshopper. You are now a master of Card-Jitsu.");

        var self:Award = this;
        setOption(options.item1, "OK", function():Void {
            self.showNinjaMask();
        });
        hideOption(options.item2);
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * Ninja Master ceremony: Step 2 - Mask award
     */
    public function showNinjaMask():Void {
        setSenseiAnim("point");
        if (howtoplay != undefined) {
            howtoplay._visible = true;
            howtoplay.gotoAndStop("mask");
            if (howtoplay.fadeInAnim != undefined) {
                howtoplay.fadeInAnim.gotoAndPlay(1);
            }
        }
        setSpeech("Take this mask as proof of your mastery.");

        var self:Award = this;
        setOption(options.item1, "OK", function():Void {
            self.showNinjaHideout();
        });
        hideOption(options.item2);
        hideOption(options.item3);
        hideOption(options.item4);
    }

    /**
     * Ninja Master ceremony: Step 3 - Secret Ninja Hideout
     */
    public function showNinjaHideout():Void {
        setSenseiAnim("point");
        if (howtoplay != undefined) {
            howtoplay._visible = true;
            howtoplay.gotoAndStop("hideout");
            if (howtoplay.fadeInAnim != undefined) {
                howtoplay.fadeInAnim.gotoAndPlay(1);
            }
        }
        setSpeech("Enter the secret Ninja Hideout and continue your journey.");

        var self:Award = this;
        setOption(options.item1, "Return to Dojo", function():Void {
            self.completeAward();
        });
        hideOption(options.item2);
        hideOption(options.item3);
        hideOption(options.item4);
    }

    public function completeAward():Void {
        ExternalInterface.call("onAwardComplete", currentRank);
        ExternalInterface.call("onFlashExit");
    }
}
