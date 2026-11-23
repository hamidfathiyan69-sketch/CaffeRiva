# آنالیز تخصصی پروژه SaynaIDE — «Mod Menu» (بازرس تاکتیکی پرمیوم)

**منبع:** Google Drive → پوشه `SaynaIDE` → `1.zip` (3,211,963 بایت ≈ 3.2 مگابایت)
**SHA-256 فایل zip:** `9e3da11613c612257024dd673a22c3f4b8b1e0b8e6bc2201833de64dca9771cc`
**تاریخ بررسی:** ۲۰۲۶-۱۱-۲۳
**وضعیت:** صرفاً تحلیل ایستا (static analysis)؛ هیچ چیزی روی دستگاه اجرا نشده است.

---

## ۱. خلاصه اجرایی

این یک **پروژهٔ Android ساخته‌شده با موتور «Sayna» (ساینا)** است — یک IDE/VM بومی اندروید که روی Termux توسعه داده شده (مسیرهای بیلد داخل باینری: `/data/data/com.termux/files/home/saynaa-packages/...`).

برنامه یک **پنجرهٔ شناور Overlay روی سایر برنامه‌ها** ایجاد می‌کند و داخل آن یک «بازرس» (Inspector) اجرا می‌شود که:

- APK میزبان (خودش) را باز کرده و entryهای آن را اسکن می‌کند (`.dex`، کتابخانه‌های `.so`، `AndroidManifest.xml`، `resources.arsc`)؛
- رشته‌های داخل DEX/متن را با بانک کلیدواژه‌های «پرمیوم / امنیتی / شبکه» اسکن کرده و آدرس‌های URL استخراج می‌کند؛
- وضعیت حافظهٔ JVM و native heap را مانیتور می‌کند؛
- ریسک‌های میزبان را می‌سنجد (debuggable، allowBackup، مجوزهای خطرناک، نشانه‌های frida/xposed/magisk/root)؛
- گزارش متنی UTF-8 با نام زماندار روی حافظهٔ برنامه ذخیره می‌کند؛
- تمام متن‌ها فارسی و UI کاملاً برنامه‌نویسی‌شده (بدون XML layout) است.

**نکتهٔ کلیدی:** موتور `libmemory.so` یک جعبه‌ابزار کامل Hook/حافظه است (Cydia Substrate + A64Hook + KittyMemory + VM اختصاصی Sayna)، اما **هیچ‌کدام از این APIها در اسکریپت‌های `.sa` فراخوانی نمی‌شوند**. قابلیت‌های برنامه تماماً با APIهای استاندارد فریم‌ورک اندروید پیاده‌سازی شده است.

---

## ۲. مشخصات پکیج (`app.cfg`)

| فیلد | مقدار |
|---|---|
| نام برنامه | `Mod Menu` |
| پکیج | `com.example.myapp19459` |
| نسخه | `1.0.0` (versionCode 1) |
| minSdk / targetSdk | 21 / 34 |
| build.debug | `false` |
| آیکون | `icon.png` |
| مجوزها | فقط `android.permission.INTERNET` |

**دو ایراد مهم در `app.cfg`:**
1. برنامه از `WindowManager` با نوع پنجرهٔ `2038` (`TYPE_APPLICATION_OVERLAY`) استفاده می‌کند؛ استفاده از آن منوط به مجوز `SYSTEM_ALERT_WINDOW` است که در `permissions` **اعلام‌نشده**. اگر سازندهٔ Sayna این مجوز را خودکار تزریق نکند، overlay روی Android ۶+ کار نمی‌کند (کد `requireOverlay()` هم فقط کاربر را به صفحهٔ تنظیمات می‌فرستد، نه مجوز را می‌سازد).
2. نام پکیج `com.example.myapp19459` — پکیج‌های `com.example.*` در Google Play رد می‌شوند و unprofessional محسوب می‌شود؛ قبل از انتشار باید عوض شود.

همچنین `INTERNET` اعلام شده ولی هیچ فراخوانی شبکه‌ای در کد دیده نمی‌شود → مجوز بی‌مورد (کاهش attack surface پیشنهاد می‌شود حذفش کنید).

---

## ۳. ساختار فایل‌ها

```
1.zip
├── app.cfg                 (256 B)   پیکربندی پروژه
├── icon.png                          آیکون 512px (ظاهراً)
├── icons/
│   ├── ic_arrow_down.png  (339 B)
│   ├── ic_arrow_right.png (349 B)
│   ├── ic_close.png       (555 B)
│   └── ic_resize.png      (406 B)
├── init.sa                 (135 B)   initializer بی‌اثر
├── main.sa               (18,905 B)  پیاده‌سازی سادهٔ overlay بازرس
├── inspector_advanced.sa (44,908 B)  پیاده‌سازی کامل و «hardened final build»
├── inspector_core.sa      (1,265 B)  ابزارهای مشترک (try/trim/pushLog/fitWindow)
├── inspector_layout.sa   (19,433 B)  موتور LoadLayout (inflater از روی Map)
├── loadlayout.sa         (27,682 B)  همان موتور با «compatibility repairs» (کاربر-محور)
├── main_layout.ly             (0 B)  فایل خالی و بلااستفادهٔ legacy
└── jniLibs/
    ├── arm64-v8a/libmemory.so  (6,702,304 B)  ELF64 AArch64
    └── armeabi-v7a/libmemory.so (5,110,200 B) ELF32 ARM
```

**SHA-256 کتابخانه‌ها:**
- arm64-v8a: `47808e7b84ffb2f99403cbe64d97d224378ead57683af971ab84d8581479cdff`
- armeabi-v7a: `ff1e59047b498bcd4cf9ff83ea4e738f19cb63c72712275af897029910d61625`

---

## ۴. تحلیل `libmemory.so` (مهندسی معکوس ایستا)

### ۴.۱ ماهیت
خروجی `nm -D --defined-only` (۲۲۴۷ نماد دینامیک) نشان می‌دهد این فایل **موتور اجرایی Sayna + جعبه‌ابزار بومی** است، نه یک کتابخانهٔ معمولی برنامه:

| مؤلفه | شواهد داخل باینری |
|---|---|
| **Sayna VM / Bytecode** | سمبل‌های `SaynaaBytecode`، `NewVM`، `FreeVM`، `CompileFileToBytecode`، `CompileStringToBytecode`، `RunFile`، `RunString`، `RunREPL`، `ImportModule`، `ExportModule`، `NewModule`، `GetSlot*`، `SetRuntimeError` |
| **Cydia Substrate** | `MSHookFunction`، `SubstrateMemoryCreate/Release`، `SubstrateProcessRef`، مسیرهای دیباگ: `src/Substrate/SubstrateHook.cpp`، `SymbolFinder.cpp`، `hde64.c` |
| **A64Hook (hook درون‌خطی ARM64)** | `A64HookInit`، `A64HookFunction(V)`، کلاس `A64Hook` |
| **KittyMemory (پروپت/خواندن/نوشتن حافظه)** | namespace `KittyMemory`: `memRead`، `memWrite`، `ProtectAddr`، `ProcMap`، `getLibraryMap`، `getAbsoluteAddress`؛ کلاس‌ها: `MemoryPatch` (`createWithHex`، `Modify`، `Restore`)، `MemoryBackup` |
| **native API عمومی** | مسیر بیلد: `saynaa-packages/common/nativeapi.c`، `saynaa-packages/projects/hello`، `saynaa-packages/projects/memory` |

وابستگی‌ها: فقط `libdl.so`، `libm.so`، `libc.so` (static-linked بقیه). نمادهای hook/patch **export شده‌اند** — یعنی هر کد nativa داخل همین پروسس می‌تواند صدایشان بزند.

### ۴.۲ جمع‌بندی امنیتی `libmemory.so`
- این کتابخانه ذاتاً **dual-use** است: هم runtime اسکریپت است، هم ابزار hook/patch. وجود آن APK را برای آنتی‌ویروس‌ها و Play Protect «مشکوک» می‌کند.
- هیچ نشانه‌ای از obfuscation یا packing نیست؛ مسیرهای بیلد و نام فایل‌های منبع به‌صورت plaintext داخل باینری هستند.
- **نکتهٔ مهم برای پورت:** چون اسکریپت‌ها هرگز `memory_hook` / `MSHookFunction` / `MemoryPatch` را صدا نمی‌زنند، برای بازسازی قابلیت‌های *فعلی* برنامه به این کتابخانه نیاز نیست؛ فقط اگر واقعاً patching حافظهٔ بازی مدنظر باشد لازم می‌شود.
- لایسنس: KittyMemory و A64Hook متن‌باز (MIT-ish) هستند؛ **Cydia Substrate لایسنس تجاری/محدود دارد** — توزیع آن در یک محصول «Premium» فروشی می‌تواند مشکل حقوقی ایجاد کند.

---

## ۵. تحلیل اسکریپت‌ها (فایل‌به‌فایل)

### ۵.۱ `init.sa` — بی‌اثر
فقط `function init() return true end`؛ ASCII-only، عملاً هیچ‌کاری نمی‌کند.

### ۵.۲ `inspector_core.sa` — هستهٔ مشترک
- `try(fn)`: پوشش یکنواخت خطا روی `pcall` → رکورد `{ok, value}` (الگوی Result).
- `trim(s)`، `pushLog(logs, item, maxLimit)` با سقف پیش‌فرض ۱۲۰ و حذف از ابتدا (ring buffer).
- `fitWindow(ctx, targetW, targetH)`: محدودکردن اندازهٔ پنجره به ابعاد صفحه با حداقل ۲۸۰×۳۲۰.

### ۵.۳ `main.sa` — نسخهٔ سادهٔ Overlay (~۱۹ KB)
- باندینگ کلاس‌های Android با `java.bindClass(...)` (ActivityThread، WindowManager، View ها…).
- ساخت دستی پنجرهٔ overlay (نوع `2038`، `FLAG_NOT_FOCUSABLE | FLAG_LAYOUT_NO_LIMITS`، گراویتی TOP|START) با نوار عنوان، دکمه‌های کوچک/بزرگ/خروج، نوار دکمه‌های اسکن، ProgressBar و ScrollView خروجی مونوکروم.
- `startScan(kind)`: مسیر APK میزبان را از `getPackageCodePath()` می‌گیرد و با `ZipFile` entryها را می‌خواند؛ `.dex` → «classes»، `lib/**.so` → «libs»، manifest/resources → «hits».
- `intelStep()`: جستجوی زیررشته‌ای `frida|xposed|substrate|root|magisk|anti|protect|shield` در نام entryها → ریسک.
- `sampleMemory()`: خواندن `Runtime.getRuntime().{total,free,max}Memory()` و `Debug.getNativeHeapAllocatedSize()`؛ تکرار هر ۱۲۰۰ms با `mainHandler.postDelayed`.
- درگ پنجره با `setOnTouchListener` روی نوار عنوان و ریسایز با `"[#]"` grip پیاده شده.
- نمونهٔ «time string» فقط ۵ رقم آخر `currentTimeMillis` را نشان می‌دهد — دقت پایین و گیج‌کننده.
- **این فایل وارد UI دومی به نام `inspector_advanced.sa` نمی‌شود؛ هر دو یک کار را با دو سطح کمال انجام می‌دهند → کد مرده/تکراری.**

### ۵.۴ `inspector_advanced.sa` — نسخهٔ کامل («Host APK inspector, hardened final build», ~۴۵ KB)
نسخهٔ حرفه‌ای همان منطق با این قابلیت‌های اضافه:

- `boot()` و حل `ctx/activity/app` از `ActivityThread.currentApplication()`؛ تشخیص نسخهٔ SDK (`Build.VERSION.SDK_INT` با fallback).
- `collectPaths()`: علاوه‌بر `app.sourceDir`، مسیر split APKها را با `java.getField(app, "splitSourceDirs")` + `ReflectArray` جمع می‌کند.
- استفاده از `dalvik.system.DexFile` برای شمارش/پیمایش کلاس‌ها (به‌جای فقط نام فایل‌ها).
- **بانک‌های کلیدواژه** (`premiumKeywords`, `securityKeywords`, `networkKeywords`, `dangerousPermissions`) و `analyzeText()`: `string.find(..., plain=true)` روی متن lowercase شده + استخراج URL با `string.gmatch("https?://...")` (سقف ۲۰۰).
- `collectRisks()`: بایت flags برنامه را می‌کاود (bit test دستی `flags % (FLAG*2) >= FLAG`) → «debuggable» و «allowBackup»؛ سپس مجوزهای `dangerousPermissions` را از `PackageManager.getPackageInfo(..., GET_PERMISSIONS)` استخراج می‌کند.
- `saveReport()`: گزارش کامل (rows/hits/urls/logs) را با `FileOutputStream` + `OutputStreamWriter(UTF-8)` می‌نویسد، `getFD().sync()`، حذف فایل ناقص در خطا، و **rename اتمیک** `.tmp → .txt` در `ctx.getFilesDir()/inspector-reports/`.
- `requireOverlay()`: روی SDK≥۲۳ ابتدا `Settings.canDrawOverlays(ctx)`؛ اگر نبود Intent به `ACTION_MANAGE_OVERLAY_PERMISSION` با `package:` URI + Toast راهنما.
- UI کامل با `LoadLayout` (نقشه‌محور) + fallback دستی، درگ/ریسایز/collapse، `refreshBounds()` با خواندن insets، `clampPosition()`، `scheduleTick/cancelTick`، و ذخیرهٔ گزارش فقط در حالت idle.
- رنگ‌بندی و متن‌ها فارسی، جدول `T` متمرکز؛ کامنت‌ها ASCII-only (انتخاب آگاهانه برای سازگاری انکودینگ).

### ۵.۵ `inspector_layout.sa` و `loadlayout.sa` — موتور لود layout (تکراری)
دو نسخهٔ تقریباً یکسان از یک **inflater اعلامی** هستند: شرح viewها به‌صورت Map (`{type="LinearLayout", orientation="vertical", children=[...]}`) دریافت و با `createView()` به درخت View بومی تبدیل می‌شود؛ شامل نگاشت `RelativeLayout` rules، `InputTypeFlag`ها، `gravity`، `bind(data)` برای data-binding دوطرفه با `ids` map و `reset_views_to_defaults()`.
- `loadlayout.sa` هدرش می‌گوید: «LoadLayout supplied by the user, with focused compatibility repairs» و از `import package` + `package.path` استفاده می‌کند.
- حجم اضافه (~۲۷ KB) عملاً کد تکراری است → یکی حذف و دیگری canonical شود.

### ۵.۶ `main_layout.ly` — خالی (۰ بایت)
ارجاع legacy؛ هیچ چیزی نمی‌خواند. حذف شود.

### ۵.۷ `icons/` و `icon.png`
چهار آیکون کوچک (پیکان پایین/راست برای collapse، ضربدر خروج، grip ریسایز) + آیکون اصلی.

---

## ۶. معماری نهایی و جریان اجرا

```
SaynaIDE (روی گوشی/شبیه‌ساز)
   └─ build → APK (com.example.myapp19459)
        └─ jniLibs/**/libmemory.so  ← Sayna VM + Substrate/A64Hook/KittyMemory
        └─ assets/scripts/*.sa      ← init.sa → main.sa (یا inspector_advanced)
             └─ overlay TYPE_APPLICATION_OVERLAY (2038)
                  ├─ اسکن خود APK (ZipFile/DexFile/reflection)
                  ├─ تحلیل متن (کلیدواژه‌ها + URL)
                  ├─ مانیتور حافظه (Runtime/Debug, هر ~۱۲۰۰ms)
                  └─ ذخیرهٔ گزارش (getFilesDir + fsync + rename اتمیک)
```

**نکتهٔ صادقانه:** با وجود عنوان «Mod Menu» و بسته‌بندی Premium، کد فعلی فقط **خودِ میزبان** را بازرسی می‌کند؛ برای اعمال تغییر روی برنامهٔ دیگر (مثلاً بازی) باید واقعاً از `memory_hook`/`MemoryPatch` استفاده شود که اکنون صدا زده نمی‌شود. یعنی «موتور مود» در این نسخه **اسکلت UI + بازرس** است، نه cheat فعال.

---

## ۷. فهرست ایرادها و ریسک‌ها (اولویت‌بندی‌شده)

| # | Severity | مورد |
|---|---|---|
| 1 | بالا | مجوز `SYSTEM_ALERT_WINDOW` در `app.cfg` اعلام‌نشده (overlay ممکن است fail شود) |
| 2 | بالا | `libmemory.so` با Cydia Substrate (لایسنس محدود) و بدون obfuscation → ریسک حقوقی + پرچم‌شدن آنتی‌ویروس |
| 3 | متوسط | دو پیاده‌سازی موازی `main.sa`/`inspector_advanced.sa` و دو موتور layout تکراری (~۴۵KB کد مرده) |
| 4 | متوسط | پکیج `com.example.myapp19459` → رد انتشار؛ `versionName/Code` بدون استراتژی |
| 5 | متوسط | مجوز `INTERNET` بی‌استفاده؛ `build.debug=false` ولی هیچ signing/minify توضیحی نیست |
| 6 | پایین | استمپ زمانی ۵رقمی از `currentTimeMillis` (چرخش هر ~۱۰۰ ثانیه) — لاگ‌ها مبهم‌اند |
| 7 | پایین | تقسیم اعداد اعشاری بدون `floor/round` در نمایش MB |
| 8 | پایین | `main_layout.ly` خالی؛ `init.sa` بی‌اثر؛ `debug("...")` در `loadlayout.sa` لاگ دیباگ در بیلد release |
| 9 | حقوقی | اگر هدف جای‌گذاری این کد در APK برنامه‌های دیگران (رپلیکیشن/resell بدون اجازه) باشد، نقض حق تکثیر و احتمالاً Computer Misuse است — خارج از محدودهٔ کمک من است |
| 10 | حقوقی | فروش «Premium» حاوی Substrate و ابزار hook بدون افشای لایسنس |

---

## ۸. آیا می‌توان آن را در VS Code اجرا کرد؟ (پاسخ صریح)

**نه، همین‌طور که هست خیر — و هیچ ترفندی آن را به پروژهٔ VS Code تبدیل نمی‌کند.** دلایل:

1. این یک پروژهٔ Gradle/Android Studio نیست؛ manifest، `build.gradle`، کد Java/Kotlin ندارد. سازنده‌اش **SaynaIDE روی خودِ گوشی (Termux-based)** است که `.sa` را با VM داخل `libmemory.so` اجرا می‌کند.
2. روی این محیط تحلیل هم: Java، Android SDK، `adb`، امولاتور نصب نیست و شبکه فقط به github/npm/pypi باز است (دانلود SDK از `dl.google.com` ممکن نیست).
3. VS Code به‌خودی‌خود امولاتور/شبیه‌ساز گوشی ندارد؛ «گوشی مجازی داخل VS Code» یعنی **آینهٔ تصویر (mirror) امولاتور Android داخل VS Code**، نه خودِ امولاتور.

### ۸.۱ مسیر A — اجرای همین پروژه روی شبیه‌ساز (پیشنهادی، بدون بازنویسی)
1. نصب Android SDK + ایجاد AVD (مثلاً `Pixel_6_API_34`) روی سیستم خودتان.
2. نصب **SaynaIDE APK** روی AVD (`adb install saynaide.apk`).
3. انتقال `1.zip` به دستگاه (`adb push 1.zip /sdcard/`) و در SaynaIDE: **Import → Build → Install → Run**.
4. اعطای مجوز «نمایش روی برنامه‌ها» (overlay) از تنظیمات.
5. نمایش تصویر داخل VS Code: پسوند **«Android iOS Emulator»** یا اجرای **scrcpy** روی AVD/دستگاه؛ خودِ بیلد و اجرا با `adb` انجام می‌شود.

### ۸.۲ مسیر B — پورت به پروژهٔ استاندارد Android (Gradle + Kotlin) تا مستقیماً از VS Code بیلد شود
امکان‌پذیر و نسبتاً تمیز است چون **منطق فعلی فقط از APIهای فریم‌ورک استفاده می‌کند**:
- جایگزینی Sayna VM با Kotlin خالص؛ حذف کامل `libmemory.so` (مگر نیاز واقعی به hook).
- `main.sa`/`inspector_advanced.sa` → یک `OverlayService` + `InspectorActivity` در Kotlin (~۲–۳ هزار خط)؛ inflater های layout با XML معمولی جایگزین می‌شوند.
- در VS Code: پسوندهای `vscjava.vscode-java-pack` + `adelphes.android-dev-ext` (یا فقط ترمینال) با Gradle Wrapper؛ بیلد: `./gradlew assembleDebug`؛ اجرا روی AVD با `adb install`.
- مزیت: تست خودکار، CI، signing، انتشار Play (با اصلاح موارد §۷).
- عیب: بازنویسی کامل؛ رفتار ۱۰۰٪ یکسان تضمین نمی‌شود؛ اگر روی ویژگی‌های بومی Sayna (مثل `package.path`, `java.mainModule`) وابسته‌اید، باید جایگزین کنید.

### ۸.۳ گوشی مجازی داخل VS Code — بهترین راه عملی
- **AVD (Android Virtual Device)** = خودِ گوشی مجازی؛ داخل **Android Studio** یا با `sdkmanager`/`avdmanager` از خط فرمان ساخته می‌شود.
- داخل VS Code یکی از این‌ها را نصب کنید:
  - پسوند **Android iOS Emulator** (نمایش و کنترل امولاتور/دستگاه داخل پنل پیش‌نمایش، مبتنی بر scrcpy) — دقیقاً همان «صفحهٔ گوشی مجازی داخل VS Code».
  - یا **scrcpy** به‌صورت اپ مستقل + `adb` (کنترل کامل، کیبورد و ماوس).
  - یا **Genymotion** (سریع‌تر از AVD روی بعضی سیستم‌ها) و آن را هم با همان پسوند آینه کنید.
- اجرای برنامه: `adb -s <emu> install -r app.apk && adb shell am start -n com.example.myapp19459/.MainActivity`
- لاگ: `adb logcat | grep -i myapp`

> جمع‌بندی: «اجرا در VS Code» = نوشتن/بیلد با VS Code؛ «دیدن گوشی مجازی در VS Code» = آینهٔ AVD با پسوند/scrcpy. هر دو در مسیرهای A و B قابل انجام‌اند.

---

## ۹. توصیه‌های نهایی

1. قبل از هر چیز معماری را یک‌دست کنید: یک entry واحد (توصیه: `inspector_advanced`)، حذف `main.sa` و یکی از دو موتور layout و `main_layout.ly`.
2. `SYSTEM_ALERT_WINDOW` را در `app.cfg` اعلام کنید و پکیج را به یک نام واقعی و متعلق‌خودتان تغییر دهید.
3. اگر هدف «فروش/resell مود منو» است: لایسنس Substrate را روشن کنید، KittyMemory/A64Hook را attribution کنید، و به‌جای تزریق در APK دیگران، آن را به‌عنوان ماژول اختیاری/اپ مستقل ارائه دهید.
4. برای رسیدن به «اجرا + تست در VS Code» سریع‌ترین راه مسیر A است؛ برای محصول قابل‌انتشار مسیر B را پیشنهاد می‌کنم — و می‌توانم همین‌جا اسکلت Gradle/Kotlin آن را بسازم.
5. گزارش این آنالیز در `docs/SaynaIDE-Analysis.md` ذخیره شد. فایل خام پروژه در `google_drive/1.zip` و خروجی extract در `saynaide/` نگه‌داشته شده‌اند (برای جلوگیری از آلودگی تاریخچهٔ git، هنوز commit نشده‌اند).
