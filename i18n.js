// ═══════════════════════════════════════════════════════════════════════
// SHARED I18N ENGINE — used by every page in the app.
//
// Mirrors index.html's own mechanism exactly, so the language a person
// picks on the landing page carries through everywhere:
//   - language stored in localStorage["eap_lang"]
//   - static text marked with data-i18n="key" gets its innerText set from
//     DICT[currentLang][key], always falling back to DICT.en[key]
//   - LANGUAGES lists all 23 languages (English + the 22 in the
//     Constitution's 8th Schedule); languages marked translated:false
//     show a small "EN for now" tag in the picker and fall back to
//     English text, same honesty approach as index.html.
//
// This file ALSO adds translateDynamic() for content that can't live in
// a fixed dictionary — vendor-typed ad titles/descriptions, generated
// notification messages. Those go through a free translation API
// (MyMemory, no key required) and are cached in localStorage so the same
// string is never re-translated twice. If the API fails or the target
// language isn't supported by it, the original English text is returned
// unchanged — dynamic content NEVER just disappears or breaks the page.
//
// USAGE on any page:
//   <script src="i18n.js"></script>
//   ...mark static text: <span data-i18n="someKey">Fallback text</span>
//   ...for dynamic content: var translated = await translateDynamic(text, currentLang);
//   ...to react when the person switches language mid-session, define:
//        window.onLangChanged = function(code) { /* re-render dynamic content */ };
// ═══════════════════════════════════════════════════════════════════════

(function () {
    var css =
        '.lang-btn { position: absolute; top: 16px; right: 16px; z-index: 60; background: rgba(255,255,255,0.9); border: none; border-radius: 20px; padding: 7px 12px 7px 10px; display: flex; align-items: center; gap: 5px; font-family: inherit; font-size: 11px; font-weight: 700; color: #01579b; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }' +
        '.lang-overlay { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.55); z-index: 500; align-items: flex-end; justify-content: center; }' +
        '.lang-overlay.open { display: flex; }' +
        '.lang-sheet { background: #fff; width: 100%; max-height: 78%; border-radius: 26px 26px 0 0; display: flex; flex-direction: column; animation: eapSheetUp 0.25s ease; }' +
        '@keyframes eapSheetUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }' +
        '.lang-sheet-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 12px; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }' +
        '.lang-sheet-title { font-size: 15px; font-weight: 800; color: #333; }' +
        '.lang-sheet-close { background: #f0f0f0; border: none; width: 28px; height: 28px; border-radius: 50%; font-size: 13px; cursor: pointer; color: #555; }' +
        '.lang-list { overflow-y: auto; padding: 8px 12px 20px; }' +
        '.lang-row { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none; text-align: left; padding: 12px 10px; border-radius: 12px; font-family: inherit; cursor: pointer; }' +
        '.lang-row:active { background: #f5f5f5; }' +
        '.lang-row.selected { background: #e3f2fd; }' +
        '.lang-native { font-size: 15px; font-weight: 700; color: #222; }' +
        '.lang-english { font-size: 10.5px; color: #999; margin-top: 1px; }' +
        '.lang-check { color: #1565c0; font-weight: 800; font-size: 14px; visibility: hidden; }' +
        '.lang-row.selected .lang-check { visibility: visible; }' +
        '.lang-beta-tag { font-size: 8.5px; font-weight: 700; color: #e65100; background: #fff3e0; padding: 1px 6px; border-radius: 6px; margin-left: 8px; flex-shrink: 0; }';
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
})();

var LANGUAGES = [
    { code:"en",  native:"English",      english:"English",   translated:true  },
    { code:"hi",  native:"हिन्दी",        english:"Hindi",      translated:true  },
    { code:"bn",  native:"বাংলা",         english:"Bengali",    translated:true  },
    { code:"te",  native:"తెలుగు",        english:"Telugu",     translated:true  },
    { code:"mr",  native:"मराठी",         english:"Marathi",    translated:true  },
    { code:"ta",  native:"தமிழ்",         english:"Tamil",      translated:true  },
    { code:"ur",  native:"اردو",          english:"Urdu",       translated:true, rtl:true },
    { code:"gu",  native:"ગુજરાતી",       english:"Gujarati",   translated:true  },
    { code:"kn",  native:"ಕನ್ನಡ",         english:"Kannada",    translated:true  },
    { code:"or",  native:"ଓଡ଼ିଆ",         english:"Odia",       translated:true  },
    { code:"ml",  native:"മലയാളം",       english:"Malayalam",  translated:true  },
    { code:"pa",  native:"ਪੰਜਾਬੀ",        english:"Punjabi",    translated:true  },
    { code:"as",  native:"অসমীয়া",       english:"Assamese",   translated:true  },
    { code:"ne",  native:"नेपाली",         english:"Nepali",     translated:true  },
    { code:"mai", native:"मैथिली",         english:"Maithili",   translated:false },
    { code:"sa",  native:"संस्कृतम्",       english:"Sanskrit",   translated:false },
    { code:"kok", native:"कोंकणी",        english:"Konkani",    translated:false },
    { code:"doi", native:"डोगरी",         english:"Dogri",      translated:false },
    { code:"brx", native:"बड़ो",          english:"Bodo",       translated:false },
    { code:"mni", native:"মৈতৈলোন্",      english:"Manipuri",   translated:false },
    { code:"sd",  native:"سنڌي",          english:"Sindhi",     translated:false, rtl:true },
    { code:"ks",  native:"کٲشُر",          english:"Kashmiri",   translated:false, rtl:true },
    { code:"sat", native:"संताली",        english:"Santali",    translated:false }
];

// DICT: one flat key-namespace shared across every page. Keys already used
// by index.html (langModal, welcomeTitle, welcomeSub, roleUserTitle,
// roleUserDesc, roleVendorTitle, roleVendorDesc) are unchanged. Keys added
// below this comment are home.html's. Each additional page adds its own
// keys the same way — see the per-page files for what's been added.
var DICT = {
    en: {
        langModal:"Select Language", welcomeTitle:"Welcome to EAP", welcomeSub:"Choose your role to start:",
        roleUserTitle:"I am a User", roleUserDesc:"View ads & earn money",
        roleVendorTitle:"I am a Vendor", roleVendorDesc:"Post ads & promote business",
        // home.html
        navHome:"Home", navAds:"Ads", navWallet:"Wallet", navSettings:"Settings",
        locLabel:"LOCATION", balLabel:"BALANCE", locatingText:"Locating…",
        mapWaiting:"Waiting for location…", mapFetching:"Fetching address…", defaultLocationLabel:"Your Location",
        menuFrameAds:"Frame Ads", menuVideoAds:"Video Ads", menuSurveys:"Surveys",
        sponsoredTasks:"Sponsored Tasks", loadingTasks:"Loading tasks…",
        noTasksLine1:"No new tasks available.", noTasksLine2:"Check back later!",
        startBtn:"Start", profileNudgeTitle:"Complete your profile",
        profileNudgeDesc:"Takes under a minute — helps us show you relevant ads"
    },
    hi: {
        langModal:"भाषा चुनें", welcomeTitle:"EAP में आपका स्वागत है", welcomeSub:"शुरू करने के लिए अपनी भूमिका चुनें:",
        roleUserTitle:"मैं एक उपयोगकर्ता हूँ", roleUserDesc:"विज्ञापन देखें और पैसे कमाएं",
        roleVendorTitle:"मैं एक वेंडर हूँ", roleVendorDesc:"विज्ञापन पोस्ट करें और व्यवसाय बढ़ाएं",
        navHome:"होम", navAds:"विज्ञापन", navWallet:"वॉलेट", navSettings:"सेटिंग्स",
        locLabel:"स्थान", balLabel:"बैलेंस", locatingText:"स्थान खोजा जा रहा है…",
        mapWaiting:"स्थान की प्रतीक्षा हो रही है…", mapFetching:"पता प्राप्त किया जा रहा है…", defaultLocationLabel:"आपका स्थान",
        menuFrameAds:"फ्रेम विज्ञापन", menuVideoAds:"वीडियो विज्ञापन", menuSurveys:"सर्वेक्षण",
        sponsoredTasks:"प्रायोजित कार्य", loadingTasks:"कार्य लोड हो रहे हैं…",
        noTasksLine1:"कोई नया कार्य उपलब्ध नहीं है।", noTasksLine2:"बाद में फिर से देखें!",
        startBtn:"शुरू करें", profileNudgeTitle:"अपनी प्रोफ़ाइल पूरी करें",
        profileNudgeDesc:"एक मिनट से भी कम समय लगेगा — इससे हमें आपको प्रासंगिक विज्ञापन दिखाने में मदद मिलती है"
    },
    bn: {
        langModal:"ভাষা নির্বাচন করুন", welcomeTitle:"EAP-এ স্বাগতম", welcomeSub:"শুরু করতে আপনার ভূমিকা বেছে নিন:",
        roleUserTitle:"আমি একজন ব্যবহারকারী", roleUserDesc:"বিজ্ঞাপন দেখুন ও আয় করুন",
        roleVendorTitle:"আমি একজন বিক্রেতা", roleVendorDesc:"বিজ্ঞাপন পোস্ট করুন ও ব্যবসা প্রচার করুন",
        navHome:"হোম", navAds:"বিজ্ঞাপন", navWallet:"ওয়ালেট", navSettings:"সেটিংস",
        locLabel:"অবস্থান", balLabel:"ব্যালেন্স", locatingText:"অবস্থান খোঁজা হচ্ছে…",
        mapWaiting:"অবস্থানের জন্য অপেক্ষা করা হচ্ছে…", mapFetching:"ঠিকানা আনা হচ্ছে…", defaultLocationLabel:"আপনার অবস্থান",
        menuFrameAds:"ফ্রেম বিজ্ঞাপন", menuVideoAds:"ভিডিও বিজ্ঞাপন", menuSurveys:"সমীক্ষা",
        sponsoredTasks:"স্পনসরড টাস্ক", loadingTasks:"টাস্ক লোড হচ্ছে…",
        noTasksLine1:"কোনো নতুন টাস্ক উপলব্ধ নেই।", noTasksLine2:"পরে আবার দেখুন!",
        startBtn:"শুরু করুন", profileNudgeTitle:"আপনার প্রোফাইল সম্পূর্ণ করুন",
        profileNudgeDesc:"এক মিনিটেরও কম সময় লাগবে — এটি আমাদের আপনাকে প্রাসঙ্গিক বিজ্ঞাপন দেখাতে সাহায্য করে"
    },
    te: {
        langModal:"భాషను ఎంచుకోండి", welcomeTitle:"EAPకి స్వాగతం", welcomeSub:"ప్రారంభించడానికి మీ పాత్రను ఎంచుకోండి:",
        roleUserTitle:"నేను ఒక వినియోగదారుడిని", roleUserDesc:"ప్రకటనలు చూడండి & సంపాదించండి",
        roleVendorTitle:"నేను ఒక వెండర్‌ని", roleVendorDesc:"ప్రకటనలు పోస్ట్ చేయండి & వ్యాపారాన్ని ప్రచారం చేయండి",
        navHome:"హోమ్", navAds:"ప్రకటనలు", navWallet:"వాలెట్", navSettings:"సెట్టింగ్‌లు",
        locLabel:"లొకేషన్", balLabel:"బ్యాలెన్స్", locatingText:"లొకేషన్ కనుగొంటున్నాము…",
        mapWaiting:"లొకేషన్ కోసం వేచి ఉంది…", mapFetching:"చిరునామా పొందుతున్నాము…", defaultLocationLabel:"మీ లొకేషన్",
        menuFrameAds:"ఫ్రేమ్ ప్రకటనలు", menuVideoAds:"వీడియో ప్రకటనలు", menuSurveys:"సర్వేలు",
        sponsoredTasks:"స్పాన్సర్డ్ టాస్క్‌లు", loadingTasks:"టాస్క్‌లు లోడ్ అవుతున్నాయి…",
        noTasksLine1:"కొత్త టాస్క్‌లు అందుబాటులో లేవు.", noTasksLine2:"తర్వాత మళ్ళీ చూడండి!",
        startBtn:"ప్రారంభించండి", profileNudgeTitle:"మీ ప్రొఫైల్‌ను పూర్తి చేయండి",
        profileNudgeDesc:"ఒక నిమిషం కంటే తక్కువ సమయం పడుతుంది — ఇది మీకు సంబంధిత ప్రకటనలను చూపించడంలో మాకు సహాయపడుతుంది"
    },
    mr: {
        langModal:"भाषा निवडा", welcomeTitle:"EAP मध्ये आपले स्वागत आहे", welcomeSub:"सुरू करण्यासाठी आपली भूमिका निवडा:",
        roleUserTitle:"मी एक वापरकर्ता आहे", roleUserDesc:"जाहिराती पहा आणि पैसे कमवा",
        roleVendorTitle:"मी एक विक्रेता आहे", roleVendorDesc:"जाहिराती पोस्ट करा आणि व्यवसाय वाढवा",
        navHome:"होम", navAds:"जाहिराती", navWallet:"वॉलेट", navSettings:"सेटिंग्ज",
        locLabel:"स्थान", balLabel:"शिल्लक", locatingText:"स्थान शोधत आहे…",
        mapWaiting:"स्थानाची प्रतीक्षा करत आहे…", mapFetching:"पत्ता मिळवत आहे…", defaultLocationLabel:"तुमचे स्थान",
        menuFrameAds:"फ्रेम जाहिराती", menuVideoAds:"व्हिडिओ जाहिराती", menuSurveys:"सर्वेक्षणे",
        sponsoredTasks:"प्रायोजित कामे", loadingTasks:"कामे लोड होत आहेत…",
        noTasksLine1:"नवीन कामे उपलब्ध नाहीत.", noTasksLine2:"नंतर पुन्हा तपासा!",
        startBtn:"सुरू करा", profileNudgeTitle:"तुमची प्रोफाइल पूर्ण करा",
        profileNudgeDesc:"एक मिनिटापेक्षा कमी वेळ लागेल — यामुळे आम्हाला तुम्हाला संबंधित जाहिराती दाखवण्यास मदत होते"
    },
    ta: {
        langModal:"மொழியைத் தேர்ந்தெடுக்கவும்", welcomeTitle:"EAP-க்கு வரவேற்கிறோம்", welcomeSub:"தொடங்க உங்கள் பங்கைத் தேர்ந்தெடுக்கவும்:",
        roleUserTitle:"நான் ஒரு பயனர்", roleUserDesc:"விளம்பரங்களைப் பார்த்து சம்பாதிக்கவும்",
        roleVendorTitle:"நான் ஒரு விற்பனையாளர்", roleVendorDesc:"விளம்பரங்களை இடுகையிட்டு வணிகத்தை மேம்படுத்தவும்",
        navHome:"முகப்பு", navAds:"விளம்பரங்கள்", navWallet:"வாலட்", navSettings:"அமைப்புகள்",
        locLabel:"இருப்பிடம்", balLabel:"இருப்பு", locatingText:"இருப்பிடம் கண்டறியப்படுகிறது…",
        mapWaiting:"இருப்பிடத்திற்காக காத்திருக்கிறது…", mapFetching:"முகவரி பெறப்படுகிறது…", defaultLocationLabel:"உங்கள் இருப்பிடம்",
        menuFrameAds:"ஃப்ரேம் விளம்பரங்கள்", menuVideoAds:"வீடியோ விளம்பரங்கள்", menuSurveys:"கணக்கெடுப்புகள்",
        sponsoredTasks:"நிதியுதவி பணிகள்", loadingTasks:"பணிகள் ஏற்றப்படுகின்றன…",
        noTasksLine1:"புதிய பணிகள் இல்லை.", noTasksLine2:"பின்னர் மீண்டும் பாருங்கள்!",
        startBtn:"தொடங்கு", profileNudgeTitle:"உங்கள் சுயவிவரத்தை முடிக்கவும்",
        profileNudgeDesc:"ஒரு நிமிடத்திற்கும் குறைவான நேரம் ஆகும் — இது பொருத்தமான விளம்பரங்களைக் காட்ட உதவுகிறது"
    },
    ur: {
        langModal:"زبان منتخب کریں", welcomeTitle:"EAP میں خوش آمدید", welcomeSub:"شروع کرنے کے لیے اپنا کردار منتخب کریں:",
        roleUserTitle:"میں ایک صارف ہوں", roleUserDesc:"اشتہارات دیکھیں اور پیسے کمائیں",
        roleVendorTitle:"میں ایک وینڈر ہوں", roleVendorDesc:"اشتہارات پوسٹ کریں اور کاروبار کو فروغ دیں",
        navHome:"ہوم", navAds:"اشتہارات", navWallet:"والیٹ", navSettings:"ترتیبات",
        locLabel:"مقام", balLabel:"بیلنس", locatingText:"مقام تلاش کیا جا رہا ہے…",
        mapWaiting:"مقام کا انتظار ہے…", mapFetching:"پتہ حاصل کیا جا رہا ہے…", defaultLocationLabel:"آپ کا مقام",
        menuFrameAds:"فریم اشتہارات", menuVideoAds:"ویڈیو اشتہارات", menuSurveys:"سروے",
        sponsoredTasks:"اسپانسرڈ کام", loadingTasks:"کام لوڈ ہو رہے ہیں…",
        noTasksLine1:"کوئی نیا کام دستیاب نہیں۔", noTasksLine2:"بعد میں دوبارہ دیکھیں!",
        startBtn:"شروع کریں", profileNudgeTitle:"اپنی پروفائل مکمل کریں",
        profileNudgeDesc:"ایک منٹ سے بھی کم وقت لگے گا — اس سے ہمیں آپ کو متعلقہ اشتہارات دکھانے میں مدد ملتی ہے"
    },
    gu: {
        langModal:"ભાષા પસંદ કરો", welcomeTitle:"EAP માં તમારું સ્વાગત છે", welcomeSub:"શરૂ કરવા માટે તમારી ભૂમિકા પસંદ કરો:",
        roleUserTitle:"હું એક વપરાશકર્તા છું", roleUserDesc:"જાહેરાતો જુઓ અને કમાણી કરો",
        roleVendorTitle:"હું એક વિક્રેતા છું", roleVendorDesc:"જાહેરાતો પોસ્ટ કરો અને વ્યવસાય પ્રમોટ કરો",
        navHome:"હોમ", navAds:"જાહેરાતો", navWallet:"વૉલેટ", navSettings:"સેટિંગ્સ",
        locLabel:"સ્થાન", balLabel:"બેલેન્સ", locatingText:"સ્થાન શોધાઈ રહ્યું છે…",
        mapWaiting:"સ્થાનની રાહ જોવાઈ રહી છે…", mapFetching:"સરનામું મેળવાઈ રહ્યું છે…", defaultLocationLabel:"તમારું સ્થાન",
        menuFrameAds:"ફ્રેમ જાહેરાતો", menuVideoAds:"વિડિયો જાહેરાતો", menuSurveys:"સર્વેક્ષણો",
        sponsoredTasks:"પ્રાયોજિત કાર્યો", loadingTasks:"કાર્યો લોડ થઈ રહ્યા છે…",
        noTasksLine1:"કોઈ નવું કાર્ય ઉપલબ્ધ નથી.", noTasksLine2:"પછીથી ફરી તપાસો!",
        startBtn:"શરૂ કરો", profileNudgeTitle:"તમારી પ્રોફાઇલ પૂર્ણ કરો",
        profileNudgeDesc:"એક મિનિટથી ઓછો સમય લાગશે — આ અમને તમને સંબંધિત જાહેરાતો બતાવવામાં મદદ કરે છે"
    },
    kn: {
        langModal:"ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ", welcomeTitle:"EAP ಗೆ ಸ್ವಾಗತ", welcomeSub:"ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ:",
        roleUserTitle:"ನಾನು ಒಬ್ಬ ಬಳಕೆದಾರ", roleUserDesc:"ಜಾಹೀರಾತುಗಳನ್ನು ವೀಕ್ಷಿಸಿ ಮತ್ತು ಗಳಿಸಿ",
        roleVendorTitle:"ನಾನು ಒಬ್ಬ ಮಾರಾಟಗಾರ", roleVendorDesc:"ಜಾಹೀರಾತುಗಳನ್ನು ಪೋಸ್ಟ್ ಮಾಡಿ ಮತ್ತು ವ್ಯಾಪಾರವನ್ನು ಉತ್ತೇಜಿಸಿ",
        navHome:"ಹೋಮ್", navAds:"ಜಾಹೀರಾತುಗಳು", navWallet:"ವಾಲೆಟ್", navSettings:"ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
        locLabel:"ಸ್ಥಳ", balLabel:"ಬ್ಯಾಲೆನ್ಸ್", locatingText:"ಸ್ಥಳ ಪತ್ತೆ ಮಾಡಲಾಗುತ್ತಿದೆ…",
        mapWaiting:"ಸ್ಥಳಕ್ಕಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ…", mapFetching:"ವಿಳಾಸ ಪಡೆಯಲಾಗುತ್ತಿದೆ…", defaultLocationLabel:"ನಿಮ್ಮ ಸ್ಥಳ",
        menuFrameAds:"ಫ್ರೇಮ್ ಜಾಹೀರಾತುಗಳು", menuVideoAds:"ವೀಡಿಯೋ ಜಾಹೀರಾತುಗಳು", menuSurveys:"ಸಮೀಕ್ಷೆಗಳು",
        sponsoredTasks:"ಪ್ರಾಯೋಜಿತ ಕಾರ್ಯಗಳು", loadingTasks:"ಕಾರ್ಯಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…",
        noTasksLine1:"ಹೊಸ ಕಾರ್ಯಗಳು ಲಭ್ಯವಿಲ್ಲ.", noTasksLine2:"ನಂತರ ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ!",
        startBtn:"ಪ್ರಾರಂಭಿಸಿ", profileNudgeTitle:"ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ",
        profileNudgeDesc:"ಒಂದು ನಿಮಿಷಕ್ಕಿಂತ ಕಡಿಮೆ ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ — ಇದು ನಿಮಗೆ ಸಂಬಂಧಿತ ಜಾಹೀರಾತುಗಳನ್ನು ತೋರಿಸಲು ನಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ"
    },
    or: {
        langModal:"ଭାଷା ବାଛନ୍ତୁ", welcomeTitle:"EAP କୁ ସ୍ୱାଗତ", welcomeSub:"ଆରମ୍ଭ କରିବାକୁ ଆପଣଙ୍କର ଭୂମିକା ବାଛନ୍ତୁ:",
        roleUserTitle:"ମୁଁ ଜଣେ ଉପଯୋଗକର୍ତ୍ତା", roleUserDesc:"ବିଜ୍ଞାପନ ଦେଖନ୍ତୁ ଏବଂ ରୋଜଗାର କରନ୍ତୁ",
        roleVendorTitle:"ମୁଁ ଜଣେ ବିକ୍ରେତା", roleVendorDesc:"ବିଜ୍ଞାପନ ପୋଷ୍ଟ କରନ୍ତୁ ଏବଂ ବ୍ୟବସାୟ ପ୍ରୋତ୍ସାହିତ କରନ୍ତୁ",
        navHome:"ହୋମ", navAds:"ବିଜ୍ଞାପନ", navWallet:"ୱାଲେଟ", navSettings:"ସେଟିଂସ",
        locLabel:"ଅବସ୍ଥାନ", balLabel:"ବାଲାନ୍ସ", locatingText:"ଅବସ୍ଥାନ ଖୋଜାଯାଉଛି…",
        mapWaiting:"ଅବସ୍ଥାନ ପାଇଁ ଅପେକ୍ଷା କରାଯାଉଛି…", mapFetching:"ଠିକଣା ଆଣାଯାଉଛି…", defaultLocationLabel:"ଆପଣଙ୍କ ଅବସ୍ଥାନ",
        menuFrameAds:"ଫ୍ରେମ ବିଜ୍ଞାପନ", menuVideoAds:"ଭିଡିଓ ବିଜ୍ଞାପନ", menuSurveys:"ସର୍ଭେ",
        sponsoredTasks:"ପ୍ରାୟୋଜିତ କାର୍ଯ୍ୟ", loadingTasks:"କାର୍ଯ୍ୟ ଲୋଡ୍ ହେଉଛି…",
        noTasksLine1:"କୌଣସି ନୂଆ କାର୍ଯ୍ୟ ଉପଲବ୍ଧ ନାହିଁ।", noTasksLine2:"ପରେ ପୁଣି ଦେଖନ୍ତୁ!",
        startBtn:"ଆରମ୍ଭ କରନ୍ତୁ", profileNudgeTitle:"ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ",
        profileNudgeDesc:"ଏକ ମିନିଟରୁ କମ୍ ସମୟ ଲାଗିବ — ଏହା ଆପଣଙ୍କୁ ପ୍ରାସଙ୍ଗିକ ବିଜ୍ଞାପନ ଦେଖାଇବାରେ ଆମକୁ ସାହାଯ୍ୟ କରେ"
    },
    ml: {
        langModal:"ഭാഷ തിരഞ്ഞെടുക്കുക", welcomeTitle:"EAP-ലേക്ക് സ്വാഗതം", welcomeSub:"ആരംഭിക്കാൻ നിങ്ങളുടെ റോൾ തിരഞ്ഞെടുക്കുക:",
        roleUserTitle:"ഞാൻ ഒരു ഉപയോക്താവ്", roleUserDesc:"പരസ്യങ്ങൾ കാണുകയും സമ്പാദിക്കുകയും ചെയ്യുക",
        roleVendorTitle:"ഞാൻ ഒരു വെണ്ടർ", roleVendorDesc:"പരസ്യങ്ങൾ പോസ്റ്റ് ചെയ്ത് ബിസിനസ്സ് പ്രമോട്ട് ചെയ്യുക",
        navHome:"ഹോം", navAds:"പരസ്യങ്ങൾ", navWallet:"വാലറ്റ്", navSettings:"ക്രമീകരണങ്ങൾ",
        locLabel:"സ്ഥലം", balLabel:"ബാലൻസ്", locatingText:"സ്ഥലം കണ്ടെത്തുന്നു…",
        mapWaiting:"സ്ഥലത്തിനായി കാത്തിരിക്കുന്നു…", mapFetching:"വിലാസം ലഭ്യമാക്കുന്നു…", defaultLocationLabel:"നിങ്ങളുടെ സ്ഥലം",
        menuFrameAds:"ഫ്രെയിം പരസ്യങ്ങൾ", menuVideoAds:"വീഡിയോ പരസ്യങ്ങൾ", menuSurveys:"സർവേകൾ",
        sponsoredTasks:"സ്പോൺസേർഡ് ടാസ്കുകൾ", loadingTasks:"ടാസ്കുകൾ ലോഡ് ചെയ്യുന്നു…",
        noTasksLine1:"പുതിയ ടാസ്കുകൾ ലഭ്യമല്ല.", noTasksLine2:"പിന്നീട് വീണ്ടും പരിശോധിക്കുക!",
        startBtn:"ആരംഭിക്കുക", profileNudgeTitle:"നിങ്ങളുടെ പ്രൊഫൈൽ പൂർത്തിയാക്കുക",
        profileNudgeDesc:"ഒരു മിനിറ്റിൽ താഴെ സമയമേ എടുക്കൂ — ഇത് പ്രസക്തമായ പരസ്യങ്ങൾ കാണിക്കാൻ ഞങ്ങളെ സഹായിക്കുന്നു"
    },
    pa: {
        langModal:"ਭਾਸ਼ਾ ਚੁਣੋ", welcomeTitle:"EAP ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ", welcomeSub:"ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ:",
        roleUserTitle:"ਮੈਂ ਇੱਕ ਯੂਜ਼ਰ ਹਾਂ", roleUserDesc:"ਇਸ਼ਤਿਹਾਰ ਦੇਖੋ ਅਤੇ ਕਮਾਓ",
        roleVendorTitle:"ਮੈਂ ਇੱਕ ਵੈਂਡਰ ਹਾਂ", roleVendorDesc:"ਇਸ਼ਤਿਹਾਰ ਪੋਸਟ ਕਰੋ ਅਤੇ ਕਾਰੋਬਾਰ ਨੂੰ ਉਤਸ਼ਾਹਿਤ ਕਰੋ",
        navHome:"ਹੋਮ", navAds:"ਇਸ਼ਤਿਹਾਰ", navWallet:"ਵਾਲਿਟ", navSettings:"ਸੈਟਿੰਗਾਂ",
        locLabel:"ਟਿਕਾਣਾ", balLabel:"ਬਕਾਇਆ", locatingText:"ਟਿਕਾਣਾ ਲੱਭਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
        mapWaiting:"ਟਿਕਾਣੇ ਦੀ ਉਡੀਕ ਹੋ ਰਹੀ ਹੈ…", mapFetching:"ਪਤਾ ਪ੍ਰਾਪਤ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ…", defaultLocationLabel:"ਤੁਹਾਡਾ ਟਿਕਾਣਾ",
        menuFrameAds:"ਫਰੇਮ ਇਸ਼ਤਿਹਾਰ", menuVideoAds:"ਵੀਡੀਓ ਇਸ਼ਤਿਹਾਰ", menuSurveys:"ਸਰਵੇਖਣ",
        sponsoredTasks:"ਸਪਾਂਸਰਡ ਕੰਮ", loadingTasks:"ਕੰਮ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…",
        noTasksLine1:"ਕੋਈ ਨਵਾਂ ਕੰਮ ਉਪਲਬਧ ਨਹੀਂ।", noTasksLine2:"ਬਾਅਦ ਵਿੱਚ ਦੁਬਾਰਾ ਦੇਖੋ!",
        startBtn:"ਸ਼ੁਰੂ ਕਰੋ", profileNudgeTitle:"ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਪੂਰੀ ਕਰੋ",
        profileNudgeDesc:"ਇੱਕ ਮਿੰਟ ਤੋਂ ਵੀ ਘੱਟ ਸਮਾਂ ਲੱਗੇਗਾ — ਇਹ ਸਾਨੂੰ ਤੁਹਾਨੂੰ ਢੁਕਵੇਂ ਇਸ਼ਤਿਹਾਰ ਦਿਖਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹੈ"
    },
    as: {
        langModal:"ভাষা বাছনি কৰক", welcomeTitle:"EAP লৈ স্বাগতম", welcomeSub:"আৰম্ভ কৰিবলৈ আপোনাৰ ভূমিকা বাছনি কৰক:",
        roleUserTitle:"মই এজন ব্যৱহাৰকাৰী", roleUserDesc:"বিজ্ঞাপন চাওক আৰু উপাৰ্জন কৰক",
        roleVendorTitle:"মই এজন বিক্ৰেতা", roleVendorDesc:"বিজ্ঞাপন পোষ্ট কৰক আৰু ব্যৱসায় প্ৰচাৰ কৰক",
        navHome:"হোম", navAds:"বিজ্ঞাপন", navWallet:"ৱালেট", navSettings:"ছেটিংছ",
        locLabel:"অৱস্থান", balLabel:"বেলেঞ্চ", locatingText:"অৱস্থান বিচাৰি থকা হৈছে…",
        mapWaiting:"অৱস্থানৰ বাবে অপেক্ষা কৰা হৈছে…", mapFetching:"ঠিকনা আনা হৈছে…", defaultLocationLabel:"আপোনাৰ অৱস্থান",
        menuFrameAds:"ফ্ৰেম বিজ্ঞাপন", menuVideoAds:"ভিডিঅ' বিজ্ঞাপন", menuSurveys:"চাৰ্ভে",
        sponsoredTasks:"পৃষ্ঠপোষকতাপ্ৰাপ্ত কাম", loadingTasks:"কাম ল'ড হৈ আছে…",
        noTasksLine1:"কোনো নতুন কাম উপলব্ধ নাই।", noTasksLine2:"পিছত পুনৰ চাওক!",
        startBtn:"আৰম্ভ কৰক", profileNudgeTitle:"আপোনাৰ প্ৰ'ফাইল সম্পূৰ্ণ কৰক",
        profileNudgeDesc:"এক মিনিটতকৈ কম সময় লাগিব — ইয়াৰ দ্বাৰা আমি আপোনাক প্ৰাসংগিক বিজ্ঞাপন দেখুৱাব পাৰোঁ"
    },
    ne: {
        langModal:"भाषा छान्नुहोस्", welcomeTitle:"EAP मा स्वागत छ", welcomeSub:"सुरु गर्न आफ्नो भूमिका छान्नुहोस्:",
        roleUserTitle:"म एक प्रयोगकर्ता हुँ", roleUserDesc:"विज्ञापनहरू हेर्नुहोस् र कमाउनुहोस्",
        roleVendorTitle:"म एक विक्रेता हुँ", roleVendorDesc:"विज्ञापनहरू पोस्ट गर्नुहोस् र व्यवसाय प्रवर्द्धन गर्नुहोस्",
        navHome:"होम", navAds:"विज्ञापनहरू", navWallet:"वालेट", navSettings:"सेटिङहरू",
        locLabel:"स्थान", balLabel:"ब्यालेन्स", locatingText:"स्थान पत्ता लगाइँदैछ…",
        mapWaiting:"स्थानको प्रतीक्षा गरिँदैछ…", mapFetching:"ठेगाना ल्याइँदैछ…", defaultLocationLabel:"तपाईंको स्थान",
        menuFrameAds:"फ्रेम विज्ञापनहरू", menuVideoAds:"भिडियो विज्ञापनहरू", menuSurveys:"सर्वेक्षणहरू",
        sponsoredTasks:"प्रायोजित कार्यहरू", loadingTasks:"कार्यहरू लोड हुँदैछ…",
        noTasksLine1:"कुनै नयाँ कार्य उपलब्ध छैन।", noTasksLine2:"पछि फेरि जाँच गर्नुहोस्!",
        startBtn:"सुरु गर्नुहोस्", profileNudgeTitle:"आफ्नो प्रोफाइल पूरा गर्नुहोस्",
        profileNudgeDesc:"एक मिनेट भन्दा कम समय लाग्छ — यसले हामीलाई तपाईंलाई सान्दर्भिक विज्ञापनहरू देखाउन मद्दत गर्छ"
    }
};

var currentLang = localStorage.getItem("eap_lang") || "en";

function t(key) {
    var d = DICT[currentLang];
    if (d && d[key]) return d[key];
    return DICT.en[key] || key; // always falls back to English, never shows a raw key
}

function applyLang(code) {
    currentLang = code;
    localStorage.setItem("eap_lang", code);

    var langMeta = LANGUAGES.find(function (l) { return l.code === code; }) || LANGUAGES[0];
    var btnLabel = document.getElementById("langBtnLabel");
    if (btnLabel) btnLabel.innerText = langMeta.english === "English" ? "EN" : langMeta.native;
    document.documentElement.setAttribute("lang", code);
    document.documentElement.setAttribute("dir", langMeta.rtl ? "rtl" : "ltr");

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
        el.innerText = t(el.getAttribute("data-i18n"));
    });

    renderLangList();

    // Page-specific hook — e.g. re-translate dynamic ad titles when the
    // person switches language mid-session. Defined per-page; harmless if absent.
    if (typeof window.onLangChanged === "function") window.onLangChanged(code);
}

function renderLangList() {
    var listEl = document.getElementById("langList");
    if (!listEl) return;
    listEl.innerHTML = "";
    LANGUAGES.forEach(function (lang) {
        var row = document.createElement("button");
        row.className = "lang-row" + (lang.code === currentLang ? " selected" : "");
        row.innerHTML =
            '<div>' +
                '<div class="lang-native">' + lang.native + (lang.translated ? "" : '<span class="lang-beta-tag">EN for now</span>') + '</div>' +
                '<div class="lang-english">' + lang.english + '</div>' +
            '</div>' +
            '<span class="lang-check">✓</span>';
        row.onclick = function () { applyLang(lang.code); closeLangSheet(); };
        listEl.appendChild(row);
    });
}

function openLangSheet() { var el = document.getElementById("langOverlay"); if (el) el.classList.add("open"); }
function closeLangSheet() { var el = document.getElementById("langOverlay"); if (el) el.classList.remove("open"); }

// Injects the language button + picker sheet into the page if it isn't
// already there (index.html has its own copy in the HTML; every other
// page gets it injected here so the markup doesn't need to be hand-copied
// into every file). Placed inside .mobile-screen so the existing
// position:absolute CSS positions it correctly, same as on index.html.
function injectLangPickerMarkup() {
    if (document.getElementById("langBtn")) return; // already present (index.html)
    var host = document.querySelector(".mobile-screen") || document.body;
    var wrap = document.createElement("div");
    wrap.innerHTML =
        '<button class="lang-btn" id="langBtn">🌐 <span id="langBtnLabel">EN</span></button>' +
        '<div class="lang-overlay" id="langOverlay">' +
            '<div class="lang-sheet">' +
                '<div class="lang-sheet-header">' +
                    '<span class="lang-sheet-title" data-i18n="langModal">Select Language</span>' +
                    '<button class="lang-sheet-close" id="langCloseBtn">✕</button>' +
                '</div>' +
                '<div class="lang-list" id="langList"></div>' +
            '</div>' +
        '</div>';
    while (wrap.firstChild) host.insertBefore(wrap.firstChild, host.firstChild);
}

function initI18n() {
    injectLangPickerMarkup();
    var btn = document.getElementById("langBtn");
    var closeBtn = document.getElementById("langCloseBtn");
    var overlay = document.getElementById("langOverlay");
    if (btn) btn.onclick = openLangSheet;
    if (closeBtn) closeBtn.onclick = closeLangSheet;
    if (overlay) overlay.onclick = function (e) { if (e.target === overlay) closeLangSheet(); };
    applyLang(currentLang);
}

// ── Dynamic content translation ──────────────────────────────────────
// For text that can never live in a fixed DICT — vendor-typed ad titles/
// descriptions, generated notification messages. Uses MyMemory (free,
// no API key). Cached per (text + target language) in localStorage so
// the same string is never sent to the API twice. On ANY failure —
// network error, unsupported language pair, quota exceeded — the
// original text is returned unchanged; dynamic content never disappears.
var TRANSLATE_CACHE_KEY = "eap_translate_cache";

function loadTranslateCache() {
    try { return JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY)) || {}; }
    catch (e) { return {}; }
}
function saveTranslateCache(cache) {
    try { localStorage.setItem(TRANSLATE_CACHE_KEY, JSON.stringify(cache)); }
    catch (e) { /* localStorage full or unavailable — just skip caching this round */ }
}

async function translateDynamic(text, targetLangCode) {
    if (!text || !String(text).trim()) return text;
    if (!targetLangCode || targetLangCode === "en") return text;

    var cache = loadTranslateCache();
    var cacheKey = targetLangCode + "::" + text;
    if (cache[cacheKey]) return cache[cacheKey];

    try {
        var res = await fetch("https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=en|" + targetLangCode);
        var data = await res.json();
        var translated = data && data.responseData && data.responseData.translatedText ? data.responseData.translatedText : null;
        // MyMemory returns the SAME text back (or an error string) for
        // language pairs it doesn't actually support — treat that as "no
        // translation available" rather than caching garbage.
        if (!translated || translated.toUpperCase().indexOf("INVALID") !== -1 || translated.toUpperCase().indexOf("QUERY LENGTH") !== -1) {
            return text;
        }
        cache[cacheKey] = translated;
        saveTranslateCache(cache);
        return translated;
    } catch (e) {
        console.error("translateDynamic error (falling back to original text):", e);
        return text;
    }
}

document.addEventListener("DOMContentLoaded", initI18n);
