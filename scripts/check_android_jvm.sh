#!/usr/bin/env bash
# Camera-independent source checks; Android SDK/device acceptance are separate.
set -eu
cd "$(dirname "$0")/.."
mkdir -p android/build/checks
if [ ! -f android/build/json-check.jar ]; then
  curl --fail --location --retry 2 https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar -o android/build/json-check.jar
fi
python3 - <<'PY'
import hashlib
from pathlib import Path
assert hashlib.sha256(Path('android/build/json-check.jar').read_bytes()).hexdigest() == '3cf6cd6892e32e2b4c1c39e0f52f5248a2f5b37646fdfbb79a66b46b618414ed', 'JSON test dependency checksum mismatch'
PY
if command -v javac >/dev/null 2>&1; then
  javac -cp android/build/json-check.jar -d android/build/checks android/app/src/main/java/ai/reachsense/dual/TimingEvidence.java android/app/src/main/java/ai/reachsense/dual/RunReport.java android/checks/*.java
else
  # Cloud Java 21 provides the compiler module without a launcher/ct.sym archive.
  java --module jdk.compiler/com.sun.tools.javac.Main -source 17 -target 17 -cp android/build/json-check.jar -d android/build/checks android/app/src/main/java/ai/reachsense/dual/TimingEvidence.java android/app/src/main/java/ai/reachsense/dual/RunReport.java android/checks/*.java
fi
java -ea -cp android/build/checks:android/build/json-check.jar ai.reachsense.dual.TimingEvidenceCheck
java -ea -cp android/build/checks:android/build/json-check.jar ai.reachsense.dual.RunReportCheck
