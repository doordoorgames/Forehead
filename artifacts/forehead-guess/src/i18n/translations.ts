export type Lang = 'en' | 'ar';

export const translations = {
  en: {
    appTitle1: 'Forehead',
    appTitle2: 'Guess',
    tagline: 'The ultimate party game!',

    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    adminPanel: 'Admin Panel',

    createRoomTitle: 'Create Room',
    createRoomDesc: 'Enter your name to start hosting.',
    yourName: 'Your Name',
    namePlaceholder: 'e.g. Alex',
    back: 'Back',
    letsGo: "Let's Go!",
    creating: 'Creating...',

    joinRoomTitle: 'Join Room',
    joinRoomDesc: 'Enter the room code and your name.',
    roomCode: 'Room Code',
    joinNamePlaceholder: 'e.g. Sam',
    joinGame: 'Join Game',
    joining: 'Joining...',

    notInRoom: 'Not in room',
    notInRoomDesc: 'Please join the room first.',
    errorCreate: 'Could not create room.',
    errorJoin: 'Could not join room. Check code.',
    errorTitle: 'Error',

    roomCodeLabel: 'Room Code',
    players: 'Players',
    you: '(you)',
    host: 'HOST',
    selectCategory: 'Select Category',
    chooseCategory: 'Choose a category...',
    words: 'words',
    startGame: 'Start Game',
    need2Players: 'Need at least 2 players',
    selectCatFirst: 'Select a category to start',
    waitingForHost: 'Waiting for host to start...',
    categoryLabel: 'Category',

    getReady: 'Get ready — place phone on forehead',
    holdTight: 'Hold on tight!',

    showReveal: 'Show Reveal →',

    yourWordWas: 'Your word was',
    playersReady: 'players ready',
    readyNextRound: 'Ready for next round',
    alreadyReady: '✓ Ready!',
    lobbyNewWord: 'Lobby for a new word',
    endGame: 'End Game',
    nextRound: 'Next Round →',
    waitingShort: 'Waiting',

    gameOver: 'Game Over!',
    returningHome: 'Returning to home...',
    goHome: 'Go Home',

    copied: 'Copied!',
    copy: 'Copy',

    rotateHint: 'Rotate your phone',
    rotateSubHint: 'This game is played in landscape mode',
  },
  ar: {
    appTitle1: 'خمّن',
    appTitle2: 'الجبهة',
    tagline: '!لعبة الحفلات الأفضل',

    createRoom: 'إنشاء غرفة',
    joinRoom: 'انضم لغرفة',
    adminPanel: 'لوحة الإدارة',

    createRoomTitle: 'إنشاء غرفة',
    createRoomDesc: '.أدخل اسمك لتبدأ كمضيف',
    yourName: 'اسمك',
    namePlaceholder: 'مثال: أحمد',
    back: 'رجوع',
    letsGo: '!انطلق',
    creating: '...جاري الإنشاء',

    joinRoomTitle: 'انضم لغرفة',
    joinRoomDesc: '.أدخل رقم الغرفة واسمك',
    roomCode: 'رقم الغرفة',
    joinNamePlaceholder: 'مثال: سارة',
    joinGame: 'انضم للعبة',
    joining: '...جاري الانضمام',

    notInRoom: 'لست في الغرفة',
    notInRoomDesc: '.يرجى الانضمام للغرفة أولاً',
    errorCreate: '.تعذر إنشاء الغرفة',
    errorJoin: '.تعذر الانضمام. تحقق من الرقم',
    errorTitle: 'خطأ',

    roomCodeLabel: 'رقم الغرفة',
    players: 'اللاعبون',
    you: '(أنت)',
    host: 'المضيف',
    selectCategory: 'اختر الفئة',
    chooseCategory: '...اختر فئة',
    words: 'كلمات',
    startGame: 'ابدأ اللعبة',
    need2Players: 'تحتاج لاعبَين على الأقل',
    selectCatFirst: 'اختر فئة للبدء',
    waitingForHost: '...انتظار بدء المضيف',
    categoryLabel: 'الفئة',

    getReady: 'استعد — ضع الهاتف على جبهتك',
    holdTight: '!تمسك جيداً',

    showReveal: '← عرض الكشف',

    yourWordWas: 'كانت كلمتك',
    playersReady: 'لاعبون جاهزون',
    readyNextRound: 'جاهز للجولة التالية',
    alreadyReady: '✓ جاهز',
    lobbyNewWord: 'لوبي لكلمة جديدة',
    endGame: 'إنهاء اللعبة',
    nextRound: '← الجولة التالية',
    waitingShort: 'انتظار',

    gameOver: '!انتهت اللعبة',
    returningHome: '...جاري العودة للرئيسية',
    goHome: 'العودة للرئيسية',

    copied: '!تم النسخ',
    copy: 'نسخ',

    rotateHint: 'اقلب هاتفك',
    rotateSubHint: 'تُلعب هذه اللعبة في وضع أفقي',
  },
} as const;

export type Translations = typeof translations.en;
