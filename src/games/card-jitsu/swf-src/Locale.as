class Locale {
    static function main(root:MovieClip):Void {
        var items:Array = [
            { id: "sensei_label", value: "Sensei" },
            { id: "pow_1", value: "Lowest card value wins this round" },
            { id: "pow_2", value: "+2 to next round's card value" },
            { id: "pow_3", value: "-2 to opponent's next card value" },
            { id: "pow_4", value: "Discards opponent's Snow card" },
            { id: "pow_5", value: "Discards opponent's Water card" },
            { id: "pow_6", value: "Discards opponent's Fire card" },
            { id: "pow_7", value: "Discards opponent's Red card" },
            { id: "pow_8", value: "Discards opponent's Blue card" },
            { id: "pow_9", value: "Discards opponent's Green card" },
            { id: "pow_10", value: "Discards opponent's Yellow card" },
            { id: "pow_11", value: "Discards opponent's Orange card" },
            { id: "pow_12", value: "Discards opponent's Purple card" },
            { id: "pow_13", value: "Block opponent Snow card next round" },
            { id: "pow_14", value: "Block opponent Fire card next round" },
            { id: "pow_15", value: "Block opponent Water card next round" },
            { id: "pow_16", value: "Snow becomes Water this round" },
            { id: "pow_17", value: "Water becomes Fire this round" },
            { id: "pow_18", value: "Fire becomes Snow this round" },
            { id: "help", value: "Card-Jitsu Help" },
            { id: "loading", value: "Loading..." }
        ];
        root.localeText = items;
    }
}
