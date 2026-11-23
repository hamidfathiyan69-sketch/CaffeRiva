#!/usr/bin/env bash
# setup-avd.sh — اسکلت نصب AVD و آماده‌سازی تست SaynaIDE روی Linux/macOS
# Usage:
#   ./scripts/setup-avd.sh                 # فقط نصب کامپوننت‌ها + ساخت AVD
#   ./scripts/setup-avd.sh --boot          # + بوت امولاتور و انتظار برای اتصال
#   ./scripts/setup-avd.sh --apk path/SaynaIDE.apk
#   ./scripts/setup-avd.sh --boot --apk path/SaynaIDE.apk
set -euo pipefail

AVD_NAME="${AVD_NAME:-Pixel_6_API_34}"
API="${API:-34}"
IMAGE="system-images;android-${API};google_apis;x86_64"
USE_BOOT=false
APK_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --boot) USE_BOOT=true; shift ;;
    --apk)  APK_PATH="${2:?path required}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { printf '\033[0;36m[setup-avd]\033[0m %s\n' "$*"; }
die() { printf '\033[0;31m[setup-avd] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

command -v adb >/dev/null || true  # فقط اطلاع؛ مسیر واقعی از ANDROID_HOME می‌آید

: "${ANDROID_HOME:=$HOME/Android/Sdk}"
SDKMANAGER="${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="${ANDROID_HOME}/cmdline-tools/latest/bin/avdmanager"
EMULATOR="${ANDROID_HOME}/emulator/emulator"
ADB="${ANDROID_HOME}/platform-tools/adb"

[[ -x "${SDKMANAGER}" ]] || die "sdkmanager پیدا نشد در ${SDKMANAGER}. اول Android cmdline-tools را به \$ANDROID_HOME/cmdline-tools/latest استخراج کنید (به docs/Run-in-VSCode.md §0.1 مراجعه کنید)."

log "ANDROID_HOME=${ANDROID_HOME}"
log "نصب/به‌روزرسانی platform-tools, emulator, platform و system-image ..."
"${SDKMANAGER}" --install "platform-tools" "emulator" "platforms;android-${API}" "${IMAGE}"

if ! "${AVDMANAGER}" list avd | grep -q "Name: ${AVD_NAME}"; then
  log "ساخت AVD: ${AVD_NAME}"
  yes | "${AVDMANAGER}" create avd -n "${AVD_NAME}" -k "${IMAGE}" -d "pixel_6" || \
    die "ساخت AVD ناموفق بود."
else
  log "AVD از قبل وجود دارد: ${AVD_NAME}"
fi

if ${USE_BOOT}; then
  log "بوت امولاتور ${AVD_NAME} (پس‌زمینه) ..."
  nohup "${EMULATOR}" -avd "${AVD_NAME}" >/tmp/emulator-${AVD_NAME}.log 2>&1 &
  log "منتظر اتصال adb ..."
  "${ADB}" wait-for-device
  # صبر تا Boot Complete
  for i in $(seq 1 60); do
    BOOT=$("${ADB}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    [[ "${BOOT}" == "1" ]] && break
    sleep 3
  done
  log "دستگاه‌ها:"; "${ADB}" devices
fi

if [[ -n "${APK_PATH}" ]]; then
  [[ -f "${APK_PATH}" ]] || die "APK وجود ندارد: ${APK_PATH}"
  log "نصب APK: ${APK_PATH}"
  "${ADB}" install -r "${APK_PATH}"
fi

log "تمام. برای نمایش داخل VS Code پسوند DiemasMichiels.emulate یا scrcpy را نصب کنید (docs/Run-in-VSCode.md §2)."
