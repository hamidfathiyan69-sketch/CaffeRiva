# Run & Test SaynaIDE «Mod Menu» — VS Code + Virtual Phone

دو مسیر واقعی وجود دارد. مسیر A برای «اجرای همین فایل امروز» و مسیر B برای «محصول قابل بیلد از VS Code» است.

> نکتهٔ صادقانه: VS Code خودش امولاتور نیست. «گوشی مجازی داخل VS Code» یعنی نمایش و کنترل امولاتور Android (AVD) داخل VS Code با پسوندهای مبتنی بر scrcpy — مانند **Android iOS Emulator** (`DiemasMichiels.emulate`) یا **Mobile Deck** (`mobilenext.mobiledeck`). خودِ دستگاه مجازی را Android SDK می‌سازد.

---

## 0) کارهای یک‌باره (Setup)

### 0.1 نصب Android SDK (بدون Android Studio — سبک‌تر)
- Linux/macOS: دانلود «command line tools» از `https://developer.android.com/studio#command-tools` و استخراج به `$ANDROID_HOME/cmdline-tools/latest`
- Windows: همان ZIP؛ متغیرهای محیطی `ANDROID_HOME` و `Path` (`%ANDROID_HOME%\cmdline-tools\latest\bin` و `%ANDROID_HOME%\platform-tools` و `%ANDROID_HOME%\emulator`) را ست کنید.

```bash
# Linux/macOS example
export ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
# (zip را در همین پوشه استخراج کنید طوری که .../cmdline-tools/latest/bin باشد)

"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"
```

> ویندوز: به‌جای \  از \ در PowerShell و از "یا ' برای رشته‌ها استفاده کنید؛ منطق همان است.

### 0.2 ساخت AVD (گوشی مجازی)
```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd \
  -n Pixel_6_API_34 -k "system-images;android-34;google_apis;x86_64" -d "pixel_6"
```
یا داخل Android Studio: `Device Manager → Create device`.

> **اجرای ARM روی x86_64:** اگر سیستم شما x86_64 است اما SaynaIDE یا کتابخانه‌هایش ARM هستند، ایمیج `google_apis;x86_64` با translator اجرا می‌شود؛ در صورت خطای اجرا، ایمیج `google_apis;arm64-v8a` را امتحان کنید (کندتر ولی سازگارتر).

### 0.3 اجرا و اتصال
```bash
"$ANDROID_HOME/emulator/emulator" -avd Pixel_6_API_34 &   # بوت امولاتور
adb devices                                                # باید emulator-5554 device بنویسد
```

---

## 1) مسیر A — اجرای همین پروژه `1.zip` با SaynaIDE (بدون بازنویسی)

1. **SaynaIDE را روی AVD نصب کنید** (APK خود SaynaIDE را — که روی گوشیتان دارید — نصب کنید):
   ```bash
   adb install SaynaIDE.apk
   ```
2. **فایل پروژه را بفرستید داخل دستگاه:**
   ```bash
   adb push google_drive/1.zip /sdcard/Download/1.zip
   ```
3. در SaynaIDE (روی امولاتور): **Import project → انتخاب `/sdcard/Download/1.zip` → Build → Install/Run**.
4. بعد از نصب برنامهٔ «Mod Menu»: تنظیم مجوزها را از طریق صفحه‌ای که برنامه باز می‌کند انجام دهید:
   - `Settings → Apps → Mod Menu → Display over other apps → Allow` (برای overlay نوع 2038 اجباری است — و در `app.cfg` اعلام‌نشده، نهایتاً باید به‌صورت دستی داده شود)
5. برنامه را اجرا کنید؛ پنجرهٔ شناور «بازرس تاکتیکی پرمیوم» باید نمایش داده شود.
6. لاگ‌ها:
   ```bash
   adb logcat | grep -iE "sayna|modmenu|example"
   ```

### اگر build داخل SaynaIDE خطا داد
- فایل `app.cfg` را اصلاح کنید:
  ```ini
  permissions = [
    "android.permission.INTERNET",
    "android.permission.SYSTEM_ALERT_WINDOW",
  ]
  ```
  و پکیج را از `com.example.myapp19459` به شناسهٔ متعلق‌خودتان (مثلاً `ir.yourname.modmenu`) تغییر دهید. سپس zip را دوباره بسازید (ساختار داخلی zip باید همان بماند: `app.cfg`، `main.sa`, `jniLibs/...`) و دوباره import کنید.
- اگر VM شما `main.sa` را entry نمی‌گیرد، `init.sa` را حفظ کنید و نقش entry را طبق مستندات SaynaIDE خودتان به آن بدهید (این رفتار به نسخهٔ SaynaIDE شما وابسته است و ما به آن دسترسی نداریم).

---

## 2) نمایش و کنترل گوشی مجازی داخل VS Code

### 2.1 پسوند Android iOS Emulator (DiemasMichiels.emulate)
1. در VS Code: `Ctrl+Shift+X` → جستجوی **Android iOS Emulator** → Install
   (یا Command Palette: `ext install DiemasMichiels.emulate`)
2. Command Palette: `Emulator: Launch Android Emulator` → انتخاب `Pixel_6_API_34`
3. در تنظیمات VS Code (Extensions → Emulator Configuration) مسیر `emulator` را در صورت نیاز ست کنید (پیش‌فرض معمولاً `$ANDROID_HOME/emulator/emulator` است).
4. برای چک‌کرد سریع دستگاه‌های متصل: Command Palette → `Emulator: List devices` یا ترمینال: `adb devices`.

### 2.2 Mobile Deck (جایگزین/مکمل)
- `ext install mobilenext.mobiledeck` → سایدبار مدیریت دستگاه‌ها داخل VS Code.

### 2.3 scrcpy (آینه‌سازی مستقل، دقیق‌تر برای تست تاچ)
```bash
# Linux: sudo apt install scrcpy   |  macOS: brew install scrcpy  |  Windows: choco install scrcpy
scrcpy --select-usb=false          # اتصال به امولاتور (TCP/ADB)
scrcpy --max-size 1024 --max-fps 60
```
سپس پنجرهٔ scrcpy را کنار VS Code نگه دارید؛ یا از همین پسوندها برای آینه داخل پنل استفاده کنید.

---

## 3) مسیر B — پورت به پروژهٔ استاندارد (Kotlin + Gradle) برای بیلد واقعی در VS Code

مزایا/معایب در `docs/SaynaIDE-Analysis.md §8.2` آمده. اگر بخواهید، در همین branch می‌توانم اسکلت را بسازم:
`settings.gradle.kts`، `app/build.gradle.kts`، `OverlayService.kt` (TYPE_APPLICATION_OVERLAY + درگ/ریسایز/collapse)، `InspectorViewModel.kt` (اسکن ZipFile/DexFile + بانک کلیدواژه + استخراج URL)، `ReportWriter.kt` (fsync + rename اتمیک)، `AndroidManifest.xml` با `SYSTEM_ALERT_WINDOW` و `application/vnd.x-service`.

بیلد و اجرا:
```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n <your.package>/.MainActivity
```

---

## 4) چک‌لیست تست رو emulator

- [ ] امولاتور بوت می‌شود و `adb devices` دستگاه را نشان می‌دهد
- [ ] SaynaIDE نصب و باز می‌شود؛ `1.zip` import می‌شود
- [ ] APK خروجی نصب می‌شود و آیکون «Mod Menu» دیده می‌شود
- [ ] با اولین اجرا، صفحهٔ تنظیم «Display over other apps» باز می‌شود و با Allow، اجرا موفق است
- [ ] پنجرهٔ شناور نمایش → دکمهٔ «اسکن کامل» → progress حرکت می‌کند → «اسکن فایل کامل شد»
- [ ] «گزارش» در `.../files/inspector-reports/` با نام `report-*.txt` ساخته می‌شود
- [ ] تغییر جهت/ریسایز/درگ پنجره بدون crash
- [ ] `adb logcat` خطای FATAL ندارد

---

## 5) ملاحظات حقوقی و لایسنس (خوانده شود)

- KittyMemory و A64Hook متن‌باز هستند؛ **Cydia Substrate لایسنس محدود دارد** — توزیع آن در محصول تجاری/resell بدون حق و افشا، مشکل حقوقی ایجاد می‌کند.
- تزریق یا repackage کردن APK برنامه/بازی دیگران بدون اجازه، و دور زدن حمایت‌های آن‌ها، خارج از محدودهٔ این راهنماست. این راهنما فقط برای ساخت و تست **پروژهٔ متعلق به خودتان** است.
- اگر هدف فروش/resell این قالب است: نام پکیج/آیکون/متن‌ها را به هویت خودتان تغییر دهید، مجوزها را شفاف اعلام کنید، و گواهی امضای release خودتان را بسازید.

## 6) اسکریپت کمکی
`scripts/setup-avd.sh` بخش‌های 0 تا 2 را به‌صورت خودکار روی Linux/macOS انجام می‌دهد (چک SDK → ساخت AVD → بوت → `adb devices`). روی Windows همان مراحل §0 و §1 را با PowerShell اجرا کنید.
