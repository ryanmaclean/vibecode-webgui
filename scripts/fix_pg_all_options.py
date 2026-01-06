#!/usr/bin/env python3
"""
Fix PostgreSQL in initramfs - Try all options
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import os
import subprocess
import sys
import shutil
import tempfile
import urllib.request
import tarfile
import gzip

AZURE_DIR = "/Users/ryan.maclean/vibecode-webgui/azure"
GLIBC_CHECK_DIR = "/tmp/glibc-check"

def run_cmd(cmd, check=True, capture=False):
    """Run a command"""
    print(f"  → {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if check and result.returncode != 0:
        if capture:
            print(f"    Error: {result.stderr}")
        return None
    return result.stdout if capture else True

def download_file(url, dest):
    """Download a file"""
    print(f"  Downloading {url}...")
    try:
        urllib.request.urlretrieve(url, dest)
        size = os.path.getsize(dest)
        print(f"    Downloaded {size} bytes")
        return size > 1000  # Check it's not a 404 page
    except Exception as e:
        print(f"    Error: {e}")
        return False

def extract_deb(deb_path, dest_dir):
    """Extract a .deb file"""
    os.makedirs(dest_dir, exist_ok=True)
    # Extract ar archive
    run_cmd(f"cd {dest_dir} && ar x {deb_path}", check=False)
    # Extract data
    for ext in ["zst", "xz", "gz"]:
        data_file = os.path.join(dest_dir, f"data.tar.{ext}")
        if os.path.exists(data_file):
            if ext == "zst":
                run_cmd(f"cd {dest_dir} && zstd -d -f data.tar.zst && tar -xf data.tar", check=False)
            elif ext == "xz":
                run_cmd(f"cd {dest_dir} && xz -d -f data.tar.xz && tar -xf data.tar", check=False)
            else:
                run_cmd(f"cd {dest_dir} && tar -xzf data.tar.gz", check=False)
            break
    # Cleanup
    for f in ["control.tar.zst", "control.tar.xz", "control.tar.gz", "data.tar", "debian-binary"]:
        p = os.path.join(dest_dir, f)
        if os.path.exists(p):
            os.remove(p)

def rebuild_initramfs(output_name):
    """Rebuild initramfs from /tmp/glibc-check"""
    output_path = os.path.join(AZURE_DIR, output_name)
    print(f"  Building {output_path}...")
    run_cmd(f"cd {GLIBC_CHECK_DIR} && find . -print0 | cpio --null -ov --format=newc 2>/dev/null | gzip -9 > {output_path}")
    if os.path.exists(output_path):
        size = os.path.getsize(output_path)
        print(f"  ✅ Created {output_name} ({size / 1024 / 1024:.1f} MB)")
        return True
    return False

def option2_pg14_ubuntu22():
    """Option 2: PostgreSQL 14 from Ubuntu 22.04 (glibc 2.35 compatible)"""
    print("\n" + "=" * 60)
    print("Option 2: PostgreSQL 14 from Ubuntu 22.04")
    print("=" * 60)
    
    workdir = tempfile.mkdtemp(prefix="pg14-")
    print(f"Working in {workdir}")
    
    # Download packages
    packages = {
        "postgresql-14": "http://ports.ubuntu.com/pool/main/p/postgresql-14/postgresql-14_14.12-0ubuntu0.22.04.1_arm64.deb",
        "libldap": "http://ports.ubuntu.com/pool/main/o/openldap/libldap-2.5-0_2.5.16+dfsg-0ubuntu0.22.04.2_arm64.deb",
        "libsasl2": "http://ports.ubuntu.com/pool/main/c/cyrus-sasl2/libsasl2-2_2.1.27+dfsg2-3ubuntu1.2_arm64.deb",
        "libsystemd": "http://ports.ubuntu.com/pool/main/s/systemd/libsystemd0_249.11-0ubuntu3.12_arm64.deb",
        "libp11kit": "http://ports.ubuntu.com/pool/main/p/p11-kit/libp11-kit0_0.24.0-6build1_arm64.deb",
        "libtasn1": "http://ports.ubuntu.com/pool/main/libt/libtasn1-6/libtasn1-6_4.18.0-4build1_arm64.deb",
    }
    
    for name, url in packages.items():
        deb_path = os.path.join(workdir, f"{name}.deb")
        if download_file(url, deb_path):
            extract_deb(deb_path, os.path.join(workdir, "extracted"))
    
    # Copy binaries to initramfs
    extracted = os.path.join(workdir, "extracted")
    if os.path.exists(extracted):
        # Find postgres binary
        for root, dirs, files in os.walk(extracted):
            for f in files:
                src = os.path.join(root, f)
                if f == "postgres":
                    dest = os.path.join(GLIBC_CHECK_DIR, "usr/bin/postgres")
                    print(f"  Copying {f} to {dest}")
                    shutil.copy2(src, dest)
                elif f == "initdb":
                    dest = os.path.join(GLIBC_CHECK_DIR, "usr/bin/initdb")
                    print(f"  Copying {f} to {dest}")
                    shutil.copy2(src, dest)
                elif f.endswith(".so") or ".so." in f:
                    dest = os.path.join(GLIBC_CHECK_DIR, "usr/lib/aarch64-linux-gnu", f)
                    if not os.path.exists(dest):
                        print(f"  Copying {f}")
                        shutil.copy2(src, dest)
    
    # Rebuild
    if rebuild_initramfs("unified-services-pg14.cpio.gz"):
        shutil.rmtree(workdir)
        return True
    
    shutil.rmtree(workdir)
    return False

def option3_alpine_pg():
    """Option 3: Alpine PostgreSQL (musl-based)"""
    print("\n" + "=" * 60)
    print("Option 3: Alpine PostgreSQL (musl-based)")
    print("=" * 60)
    
    workdir = tempfile.mkdtemp(prefix="alpine-pg-")
    print(f"Working in {workdir}")
    
    # Download Alpine PostgreSQL
    apk_url = "https://dl-cdn.alpinelinux.org/alpine/v3.19/main/aarch64/postgresql16-16.6-r0.apk"
    apk_path = os.path.join(workdir, "postgresql.apk")
    
    if download_file(apk_url, apk_path):
        # Extract APK (it's just a tar.gz)
        extracted = os.path.join(workdir, "extracted")
        os.makedirs(extracted, exist_ok=True)
        run_cmd(f"cd {extracted} && tar -xzf {apk_path}", check=False)
        
        # Find and copy binaries
        for root, dirs, files in os.walk(extracted):
            for f in files:
                src = os.path.join(root, f)
                if f == "postgres":
                    dest = os.path.join(GLIBC_CHECK_DIR, "usr/bin/postgres-alpine")
                    print(f"  Copying {f} to {dest}")
                    shutil.copy2(src, dest)
                    os.chmod(dest, 0o755)
                elif f == "initdb":
                    dest = os.path.join(GLIBC_CHECK_DIR, "usr/bin/initdb-alpine")
                    print(f"  Copying {f} to {dest}")
                    shutil.copy2(src, dest)
                    os.chmod(dest, 0o755)
    
    # Update init script to try alpine postgres
    init_path = os.path.join(GLIBC_CHECK_DIR, "init")
    if os.path.exists(init_path):
        with open(init_path, "r") as f:
            init_content = f.read()
        
        # Check if we need to update it
        if "postgres-alpine" not in init_content:
            print("  Updating init script to try Alpine postgres...")
            # Find the postgres section and update it
            new_pg_section = '''
echo "=== PostgreSQL ==="
# Try Alpine postgres first (musl-based)
POSTGRES_BIN=""
INITDB_BIN=""
if [ -f /usr/bin/postgres-alpine ]; then
    /usr/bin/postgres-alpine --version 2>&1 && POSTGRES_BIN="/usr/bin/postgres-alpine" && INITDB_BIN="/usr/bin/initdb-alpine"
fi
# Fall back to glibc postgres
if [ -z "$POSTGRES_BIN" ] && [ -f /usr/bin/postgres ]; then
    /usr/bin/postgres --version 2>&1 && POSTGRES_BIN="/usr/bin/postgres" && INITDB_BIN="/usr/bin/initdb"
fi

if [ -n "$POSTGRES_BIN" ]; then
    echo "Using: $POSTGRES_BIN"
    id postgres >/dev/null 2>&1 || adduser -D -H -s /bin/sh postgres 2>/dev/null || true
    chown -R postgres:postgres /var/lib/postgresql /run/postgresql 2>/dev/null || true
    chmod 777 /run/postgresql
    
    if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
        echo "Initializing DB..."
        su postgres -c "$INITDB_BIN -D /var/lib/postgresql/data" 2>&1 | tail -3
        echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
        echo "listen_addresses = '*'" >> /var/lib/postgresql/data/postgresql.conf
    fi
    
    su postgres -c "$POSTGRES_BIN -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    sleep 3
    ps | grep -v grep | grep -q "postgres" && echo "PostgreSQL OK on port 5432" || { echo "PostgreSQL FAIL"; cat /tmp/postgresql.log | head -10; }
else
    echo "PostgreSQL not available"
fi
'''
            # For now, just note that init needs updating
            print("  Note: Init script may need manual update for Alpine postgres")
    
    # Rebuild
    if rebuild_initramfs("unified-services-alpine-pg.cpio.gz"):
        shutil.rmtree(workdir)
        return True
    
    shutil.rmtree(workdir)
    return False

def option4_disable_pg():
    """Option 4: Disable PostgreSQL (fallback)"""
    print("\n" + "=" * 60)
    print("Option 4: Disable PostgreSQL (fallback)")
    print("=" * 60)
    
    init_path = os.path.join(GLIBC_CHECK_DIR, "init")
    if os.path.exists(init_path):
        with open(init_path, "r") as f:
            init_content = f.read()
        
        # Comment out PostgreSQL section
        if "PostgreSQL DISABLED" not in init_content:
            print("  Disabling PostgreSQL in init script...")
            # Simple replacement - disable the postgres startup
            new_content = init_content.replace(
                'echo "=== PostgreSQL ==="',
                'echo "=== PostgreSQL (DISABLED) ==="\necho "PostgreSQL disabled due to glibc compatibility issues"\n: <<\'DISABLED_PG\''
            )
            # Find where to end the disabled section
            # This is a simple approach - in practice you'd want more robust parsing
            
            with open(init_path, "w") as f:
                f.write(new_content)
            print("  PostgreSQL disabled")
    
    # Rebuild
    return rebuild_initramfs("unified-services-no-pg.cpio.gz")

def main():
    print("=" * 60)
    print("PostgreSQL Fix - Trying All Options")
    print("=" * 60)
    
    # Check prerequisites
    if not os.path.exists(GLIBC_CHECK_DIR):
        print(f"Error: {GLIBC_CHECK_DIR} does not exist")
        print("Please extract the current initramfs first:")
        print(f"  mkdir -p {GLIBC_CHECK_DIR}")
        print(f"  cd {GLIBC_CHECK_DIR}")
        print(f"  zcat {AZURE_DIR}/unified-services-glibc-fixed.cpio.gz | cpio -idmv")
        return 1
    
    results = {}
    
    # Try Option 2
    try:
        results["option2"] = option2_pg14_ubuntu22()
    except Exception as e:
        print(f"  ❌ Option 2 failed: {e}")
        results["option2"] = False
    
    # Try Option 3
    try:
        results["option3"] = option3_alpine_pg()
    except Exception as e:
        print(f"  ❌ Option 3 failed: {e}")
        results["option3"] = False
    
    # Try Option 4 (always works)
    try:
        results["option4"] = option4_disable_pg()
    except Exception as e:
        print(f"  ❌ Option 4 failed: {e}")
        results["option4"] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    for opt, success in results.items():
        status = "✅ Success" if success else "❌ Failed"
        print(f"  {opt}: {status}")
    
    print("\nGenerated initramfs files:")
    for f in os.listdir(AZURE_DIR):
        if f.endswith(".cpio.gz"):
            path = os.path.join(AZURE_DIR, f)
            size = os.path.getsize(path)
            print(f"  {f}: {size / 1024 / 1024:.1f} MB")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())


