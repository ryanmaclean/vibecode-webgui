cmd_applets/applets.o := gcc -Wp,-MD,applets/.applets.o.d   -std=gnu99 -Iinclude -Ilibbb  -include include/autoconf.h -D_GNU_SOURCE -DNDEBUG -D_LARGEFILE_SOURCE -D_LARGEFILE64_SOURCE -D_FILE_OFFSET_BITS=64 -DBB_VER='"1.36.1"'   -Wall -Wshadow -Wwrite-strings -Wundef -Wstrict-prototypes -Wunused -Wunused-parameter -Wunused-function -Wunused-value -Wmissing-prototypes -Wmissing-declarations -Wno-format-security -Wdeclaration-after-statement -Wold-style-definition -finline-limit=0 -fno-builtin-strlen -fomit-frame-pointer -ffunction-sections -fdata-sections  -funsigned-char -static-libgcc -falign-functions=1 -falign-jumps=1 -falign-labels=1 -falign-loops=1 -fno-unwind-tables -fno-asynchronous-unwind-tables -fno-builtin-printf -Oz     -DKBUILD_BASENAME='"applets"'  -DKBUILD_MODNAME='"applets"' -c -o applets/applets.o applets/applets.c

deps_applets/applets.o := \
  applets/applets.c \
    $(wildcard include/config/build/libbusybox.h) \
  include/busybox.h \
    $(wildcard include/config/feature/prefer/applets.h) \
    $(wildcard include/config/feature/sh/standalone.h) \
    $(wildcard include/config/feature/sh/nofork.h) \
    $(wildcard include/config/feature/suid.h) \
    $(wildcard include/config/feature/installer.h) \
    $(wildcard include/config/feature/shared/busybox.h) \
  include/libbb.h \
    $(wildcard include/config/feature/shadowpasswds.h) \
    $(wildcard include/config/use/bb/shadow.h) \
    $(wildcard include/config/selinux.h) \
    $(wildcard include/config/feature/utmp.h) \
    $(wildcard include/config/locale/support.h) \
    $(wildcard include/config/use/bb/pwd/grp.h) \
    $(wildcard include/config/lfs.h) \
    $(wildcard include/config/feature/buffers/go/on/stack.h) \
    $(wildcard include/config/feature/buffers/go/in/bss.h) \
    $(wildcard include/config/extra/cflags.h) \
    $(wildcard include/config/variable/arch/pagesize.h) \
    $(wildcard include/config/feature/verbose.h) \
    $(wildcard include/config/feature/etc/services.h) \
    $(wildcard include/config/feature/ipv6.h) \
    $(wildcard include/config/feature/seamless/xz.h) \
    $(wildcard include/config/feature/seamless/lzma.h) \
    $(wildcard include/config/feature/seamless/bz2.h) \
    $(wildcard include/config/feature/seamless/gz.h) \
    $(wildcard include/config/feature/seamless/z.h) \
    $(wildcard include/config/float/duration.h) \
    $(wildcard include/config/feature/check/names.h) \
    $(wildcard include/config/long/opts.h) \
    $(wildcard include/config/feature/pidfile.h) \
    $(wildcard include/config/feature/syslog.h) \
    $(wildcard include/config/feature/syslog/info.h) \
    $(wildcard include/config/warn/simple/msg.h) \
    $(wildcard include/config/feature/individual.h) \
    $(wildcard include/config/shell/ash.h) \
    $(wildcard include/config/shell/hush.h) \
    $(wildcard include/config/echo.h) \
    $(wildcard include/config/sleep.h) \
    $(wildcard include/config/printf.h) \
    $(wildcard include/config/test.h) \
    $(wildcard include/config/test1.h) \
    $(wildcard include/config/test2.h) \
    $(wildcard include/config/kill.h) \
    $(wildcard include/config/killall.h) \
    $(wildcard include/config/killall5.h) \
    $(wildcard include/config/chown.h) \
    $(wildcard include/config/ls.h) \
    $(wildcard include/config/xxx.h) \
    $(wildcard include/config/route.h) \
    $(wildcard include/config/feature/hwib.h) \
    $(wildcard include/config/desktop.h) \
    $(wildcard include/config/feature/crond/d.h) \
    $(wildcard include/config/feature/setpriv/capabilities.h) \
    $(wildcard include/config/run/init.h) \
    $(wildcard include/config/feature/securetty.h) \
    $(wildcard include/config/pam.h) \
    $(wildcard include/config/use/bb/crypt.h) \
    $(wildcard include/config/feature/adduser/to/group.h) \
    $(wildcard include/config/feature/del/user/from/group.h) \
    $(wildcard include/config/ioctl/hex2str/error.h) \
    $(wildcard include/config/feature/editing.h) \
    $(wildcard include/config/feature/editing/history.h) \
    $(wildcard include/config/feature/tab/completion.h) \
    $(wildcard include/config/feature/username/completion.h) \
    $(wildcard include/config/feature/editing/fancy/prompt.h) \
    $(wildcard include/config/feature/editing/savehistory.h) \
    $(wildcard include/config/feature/editing/vi.h) \
    $(wildcard include/config/feature/editing/save/on/exit.h) \
    $(wildcard include/config/pmap.h) \
    $(wildcard include/config/feature/show/threads.h) \
    $(wildcard include/config/feature/ps/additional/columns.h) \
    $(wildcard include/config/feature/topmem.h) \
    $(wildcard include/config/feature/top/smp/process.h) \
    $(wildcard include/config/pgrep.h) \
    $(wildcard include/config/pkill.h) \
    $(wildcard include/config/pidof.h) \
    $(wildcard include/config/sestatus.h) \
    $(wildcard include/config/unicode/support.h) \
    $(wildcard include/config/feature/mtab/support.h) \
    $(wildcard include/config/feature/clean/up.h) \
    $(wildcard include/config/feature/devfs.h) \
  include/platform.h \
    $(wildcard include/config/werror.h) \
    $(wildcard include/config/big/endian.h) \
    $(wildcard include/config/little/endian.h) \
    $(wildcard include/config/nommu.h) \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/limits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/limits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/cdefs.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_symbol_aliasing.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_posix_availability.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/ptrcheck.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/limits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/limits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/_limits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/syslimits.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/resource.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/appleapiopts.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/_types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/_types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_types.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/stdint.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/stdint.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_int8_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_int16_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_int32_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_int64_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_uint8_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_uint16_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_uint32_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_uint64_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_intptr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_uintptr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_intmax_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types/_uintmax_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/Availability.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/AvailabilityVersions.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/AvailabilityInternal.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/AvailabilityInternalLegacy.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_timeval.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_int8_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_int16_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_int32_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_int64_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_id_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/_endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/_endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/__endian.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/libkern/_OSByteOrder.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/libkern/i386/_OSByteOrder.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/stdbool.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/unistd.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_bounds.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/unistd.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_posix_vdisable.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_seek_set.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_size_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_ssize_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_uid_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_gid_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_off_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_pid_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_useconds_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_null.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_ctermid.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/select.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_def.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_timespec.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_time_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_suseconds_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_sigset_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_setsize.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_set.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_clr.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_isset.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_zero.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fd_copy.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_select.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_dev_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_mode_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_uuid_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/gethostuuid.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/stdio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_stdio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_va_list.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/stdio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_printf.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/secure/_stdio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/secure/_common.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/types.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_char.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_short.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_u_int.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_caddr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_blkcnt_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_blksize_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_in_addr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_in_port_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_ino_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_ino64_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_key_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_nlink_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_clock_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_rsize_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_errno_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_attr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_cond_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_condattr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_mutex_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_mutexattr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_once_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_rwlock_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_rwlockattr_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_pthread/_pthread_key_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fsblkcnt_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_fsfilcnt_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/ctype.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_ctype.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/runetype.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_ct_rune_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_rune_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_wchar_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_wint_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/dirent.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/dirent.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/errno.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/errno.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/fcntl.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/fcntl.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_o_sync.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_o_dsync.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_s_ifmt.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_filesec_t.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/inttypes.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/inttypes.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_inttypes.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/netdb.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_socklen_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/netinet/in.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/socket.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/constrained_ctypes.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/_param.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/_param.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/net/net_kev.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_sa_family_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_iovec_t.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/netinet6/in6.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/setjmp.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/signal.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/signal.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/signal.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/signal.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/_mcontext.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/_mcontext.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/mach/machine/_structs.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/mach/i386/_structs.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_sigaltstack.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_ucontext.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/paths.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/paths.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/stdlib.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_stdlib.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/wait.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/alloca.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/malloc/_malloc.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/malloc/_malloc_type.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/malloc/_ptrcheck.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_abort.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/stdarg.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg_header_macro.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg___gnuc_va_list.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg_va_list.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg_va_arg.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg___va_copy.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stdarg_va_copy.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/stddef.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/stddef.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_header_macro.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_ptrdiff_t.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_size_t.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_rsize_t.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_wchar_t.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_null.h \
  /Library/Developer/CommandLineTools/usr/lib/clang/17/include/__stddef_offsetof.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/string.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_string.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_strings.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/secure/_strings.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/secure/_string.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/libgen.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/poll.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/poll.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/ioctl.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/ttycom.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/ioccom.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/filio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/sockio.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/net/if.h \
    $(wildcard include/config/namesize.h) \
    $(wildcard include/config/wake/on/magic/packet.h) \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/net/if_var.h \
    $(wildcard include/config/minmtu.h) \
    $(wildcard include/config/maxmtu.h) \
    $(wildcard include/config/data/timeval.h) \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/time.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_timeval64.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/time.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/_time.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/_types/_timeval32.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/mman.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/stat.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/termios.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/termios.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/ttydefaults.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/param.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/machine/param.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/i386/param.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/pwd.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/uuid/uuid.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/grp.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/utmp.h \
  /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/utmpx.h \
  include/pwd_.h \
  include/grp_.h \
  include/shadow_.h \
  include/xatonum.h \
  include/applet_metadata.h \
    $(wildcard include/config/install/no/usr.h) \

applets/applets.o: $(deps_applets/applets.o)

$(deps_applets/applets.o):
