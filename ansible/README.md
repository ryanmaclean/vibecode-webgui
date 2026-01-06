# VibeCode Ansible Playbooks

Ansible playbooks for building and managing VibeCode VM infrastructure.

## Prerequisites

```bash
# Install Ansible
brew install ansible

# Install required collections
cd ansible
ansible-galaxy install -r requirements.yml
```

## Quick Start

### Build the Services Initramfs

```bash
cd ansible
ansible-playbook playbooks/build-initramfs.yml
```

This will:
1. Download Ubuntu 22.04 packages for arm64
2. Extract and install them into the initramfs
3. Generate the init script from template
4. Build `azure/unified-services-glibc-fixed.cpio.gz`

### Customizing the Build

Edit `playbooks/build-initramfs.yml` to:
- Change package versions
- Enable/disable services
- Modify the VM hostname

Or override variables at runtime:

```bash
ansible-playbook playbooks/build-initramfs.yml \
  -e "vm_hostname=my-custom-vm" \
  -e "services.postgresql.enabled=false"
```

## Directory Structure

```
ansible/
├── ansible.cfg           # Ansible configuration
├── inventory/
│   └── localhost.yml     # Local inventory
├── playbooks/
│   └── build-initramfs.yml  # Main build playbook
├── roles/
│   └── initramfs/        # Reusable initramfs role
│       ├── tasks/
│       │   ├── main.yml
│       │   └── install_libraries.yml
│       └── defaults/
│           └── main.yml
├── templates/
│   └── init.j2           # Init script template
└── requirements.yml      # Galaxy dependencies
```

## Services Included

| Service    | Port | Description |
|------------|------|-------------|
| Valkey     | 6379 | Redis-compatible in-memory store |
| PostgreSQL | 5432 | Relational database |
| OpenVSCode | 8080 | Web-based VS Code |
| SSH        | 22   | Dropbear SSH server |
| Avahi      | 5353 | mDNS for hostname resolution |

## Accessing the VM

After boot, the VM is accessible via:

```bash
# Via mDNS hostname
ssh root@vibecode-vm.local

# Via IP (check console for address)
ssh root@192.168.64.x
```

## Troubleshooting

### Package Download Failures

If packages fail to download, check:
1. Network connectivity
2. Ubuntu mirror availability
3. Package version exists (versions change frequently)

Update URLs in `playbooks/build-initramfs.yml` if needed.

### Missing Libraries

If services fail with "cannot open shared object file":
1. Check which library is missing from the error
2. Find the Ubuntu package containing it
3. Add to the `packages` list in the playbook

### Ansible Errors

```bash
# Verbose output
ansible-playbook playbooks/build-initramfs.yml -vvv

# Check syntax
ansible-playbook playbooks/build-initramfs.yml --syntax-check
```

## License

MIT
