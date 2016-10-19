declare namespace NodeGit {
    export class AnnotatedCommit {
        static fromFetchhead(repo: NodeGit.Repository, branch_name: string, remote_url: string, id: NodeGit.Oid): Promise<NodeGit.AnnotatedCommit>;
        static fromRef(repo: NodeGit.Repository, ref: NodeGit.Reference): Promise<NodeGit.AnnotatedCommit>;
        static fromRevspec(repo: NodeGit.Repository, revspec: string): Promise<NodeGit.AnnotatedCommit>;
        static lookup(repo: NodeGit.Repository, id: NodeGit.Oid): Promise<NodeGit.AnnotatedCommit>;

        free(): void;
        id(): NodeGit.Oid;
    }

    namespace Attr {
        enum STATES {
            UNSPECIFIED_T = 0,
            TRUE_T = 1,
            FALSE_T = 2,
            VALUE_T = 3
        }
    }

    export class Attr {
        static addMacro(repo: NodeGit.Repository, name: string, values: string): number;
        static cacheFlush(repo: NodeGit.Repository): void;
        static get(repo: NodeGit.Repository, flags: number, path: string, name: string): Promise<string>;
        static getMany(repo: NodeGit.Repository, flags: number, path: string, num_attr: number, names: string): any[];
        static value(attr: string): number;
    }

    namespace Blame {
        enum FLAG {
            NORMAL = 0,
            TRACK_COPIES_SAME_FILE = 1,
            TRACK_COPIES_SAME_COMMIT_MOVES = 2,
            TRACK_COPIES_SAME_COMMIT_COPIES = 4,
            TRACK_COPIES_ANY_COMMIT_COPIES = 8,
            FIRST_PARENT = 16
        }
    }

    export class Blame {
        static file(repo: NodeGit.Repository, path: string, options?: NodeGit.BlameOptions): NodeGit.Blame;
        static initOptions(opts: NodeGit.BlameOptions, version: number): number;

        buffer(buffer: string, buffer_len: number): Promise<NodeGit.Blame>;
        free(): void;
        getHunkByIndex(index: number): NodeGit.BlameHunk;
        getHunkByLine(lineno: number): NodeGit.BlameHunk;
        getHunkCount(): number;
    }

    export class BlameHunk {
        linesInHunk: number;
        finalCommitId: NodeGit.Oid;
        finalStartLineNumber: number;
        finalSignature: NodeGit.Signature;
        origCommitId: NodeGit.Oid;
        origPath: string;
        origStartLineNumber: number;
        origSignature: NodeGit.Signature;
    }

    export interface BlameOptions {
        version: number;
        flags: number;
        minMatchCharacters: number;
        newestCommit: NodeGit.Oid;
        oldestCommit: NodeGit.Oid;
        minLine: number;
        maxLine: number;
    }

    export class Blob {
        static createFromBuffer(repo: NodeGit.Repository, buffer: Buffer, len: number): NodeGit.Oid;
        static createFromDisk(id: NodeGit.Oid, repo: NodeGit.Repository, path: string): number;
        static createFromWorkdir(id: NodeGit.Oid, repo: NodeGit.Repository, relative_path: string): number;
        static lookup(repo: NodeGit.Repository, id: string | Oid | Blob): Promise<NodeGit.Blob>;
        static lookupPrefix(repo: NodeGit.Repository, id: NodeGit.Oid, len: number): Promise<NodeGit.Blob>;

        free(): void;
        id(): NodeGit.Oid;
        isBinary(): number;
        owner(): NodeGit.Repository;
        rawcontent(): Buffer;
        rawsize(): number;
        content(): Buffer;
        toString(): string;
        filemode(): number;
    }

    namespace Branch {
        enum BRANCH {
            LOCAL = 1,
            REMOTE = 2,
            ALL = 3
        }
    }

    export class Branch {
        static create(repo: NodeGit.Repository, branch_name: string, target: NodeGit.Commit, force: number): Promise<NodeGit.Reference>;
        static createFromAnnotated(repository: NodeGit.Repository, branch_name: string, commit: NodeGit.AnnotatedCommit, force: number): Reference;
        static delete(branch: NodeGit.Reference): number;
        static isHead(branch: NodeGit.Reference): number;
        static iteratorNew(repo: NodeGit.Repository, list_flags: number): Promise<NodeGit.BranchIterator>;
        static lookup(repo: NodeGit.Repository, branch_name: string, branch_type: number): Promise<NodeGit.Reference>;
        static move(branch: NodeGit.Reference, new_branch_name: string, force: number): Promise<NodeGit.Reference>;
        static name(ref: NodeGit.Reference): Promise<string>;
        static setUpstream(branch: NodeGit.Reference, upstream_name: string): Promise<number>;
        static upstream(branch: NodeGit.Reference): Promise<NodeGit.Reference>;
    }

    export class BranchIterator {
    }

    export class Buf {
        containsNul(): number;
        free(): void;
        grow(target_size: number): Promise<NodeGit.Buf>;
        isBinary(): number;
        set(data: Buffer, datalen: number): Promise<NodeGit.Buf>;
        ptr: string;
        asize: number;
        size: number;
    }

    namespace Cert {
        enum TYPE {
            NONE = 0,
            X509 = 1,
            HOSTKEY_LIBSSH2 = 2,
            STRARRAY = 3
        }

        enum SSH {
                    MD5 = 1,
            SHA1 = 2
        }
    }

    export class Cert {
        certType: number;
    }

    export class CertHostkey {
        certType: number;
        type: number;
        hashMd5: string;
        hashSha1: string;
    }

    export class CertX509 {
        certType: number;
        data: Buffer;
        len: number;
    }

    namespace Checkout {
        enum NOTIFY {
            NONE = 0,
            CONFLICT = 1,
            DIRTY = 2,
            UPDATED = 4,
            UNTRACKED = 8,
            IGNORED = 16,
            ALL = 65535
        }

        enum STRATEGY {
            NONE = 0,
            SAFE = 1,
            FORCE = 2,
            RECREATE_MISSING = 4,
            ALLOW_CONFLICTS = 16,
            REMOVE_UNTRACKED = 32,
            REMOVE_IGNORED = 64,
            UPDATE_ONLY = 128,
            DONT_UPDATE_INDEX = 256,
            NO_REFRESH = 512,
            SKIP_UNMERGED = 1024,
            USE_OURS = 2048,
            USE_THEIRS = 4096,
            DISABLE_PATHSPEC_MATCH = 8192,
            SKIP_LOCKED_DIRECTORIES = 262144,
            DONT_OVERWRITE_IGNORED = 524288,
            CONFLICT_STYLE_MERGE = 1048576,
            CONFLICT_STYLE_DIFF3 = 2097152,
            DONT_REMOVE_EXISTING = 4194304,
            DONT_WRITE_INDEX = 8388608,
            UPDATE_SUBMODULES = 65536,
            UPDATE_SUBMODULES_IF_CHANGED = 131072
        }
    }

    export class Checkout {
        static head(repo: NodeGit.Repository, options?: NodeGit.CheckoutOptions): Promise<void>;
        static index(repo: NodeGit.Repository, The: NodeGit.Index, options?: NodeGit.CheckoutOptions): Promise<void>;
        static initOptions(opts: NodeGit.CheckoutOptions, version: number): number;
        static tree(repo: NodeGit.Repository, treeish: NodeGit.Oid | Tree | Commit | Reference, options?: NodeGit.CheckoutOptions): Promise<void>;
    }

    export interface CheckoutOptions {
        version?: number;
        checkoutStrategy?: number;
        disableFilters?: number;
        dirMode?: number;
        fileMode?: number;
        fileOpenFlags?: number;
        notifyFlags?: number;
        notifyCb?: any;
        notifyPayload?: void;
        progressCb?: any;
        progressPayload?: void;
        paths?: NodeGit.Strarray;
        baseline?: NodeGit.Tree;
        baselineIndex?: NodeGit.Index;
        targetDirectory?: string;
        ancestorLabel?: string;
        ourLabel?: string;
        theirLabel?: string;
        perfdataCb?: any;
        perfdataPayload?: void;
    }

    export class Cherrypick {
        static cherrypick(repo: NodeGit.Repository, commit: NodeGit.Commit, options?: NodeGit.CherrypickOptions): Promise<number>;
        static commit(repo: NodeGit.Repository, cherrypick_commit: NodeGit.Commit, our_commit: NodeGit.Commit, mainline: number, merge_options?: NodeGit.MergeOptions): Promise<number>;
        static initOptions(opts: NodeGit.CherrypickOptions, version: number): number;
    }

    export interface CherrypickOptions {
        version: number;
        mainline: number;
        mergeOpts: NodeGit.MergeOptions;
        checkoutOpts: NodeGit.CheckoutOptions;
    }

    namespace Clone {
        enum LOCAL {
            AUTO = 0,
            LOCAL = 1,
            NO_LOCAL = 2,
            NO_LINKS = 3
        }
    }

    export class Clone {
        static clone(url: string, local_path: string, options?: NodeGit.CloneOptions): Promise<NodeGit.Repository>;
        static initOptions(opts: NodeGit.CloneOptions, version: number): number;
    }

    export interface CloneOptions {
        version?: number;
        checkoutOpts?: NodeGit.CheckoutOptions;
        fetchOpts?: NodeGit.FetchOptions;
        bare?: number;
        local?: number;
        checkoutBranch?: string;
        repositoryCbPayload?: void;
        remoteCbPayload?: void;
    }

    export interface EventEmitter extends NodeJS.EventEmitter {
        start(): void
    }

    export class Commit {
        static create(repo: NodeGit.Repository, update_ref: string, author: NodeGit.Signature, committer: NodeGit.Signature, message_encoding: string, message: string, tree: NodeGit.Tree, parent_count: number, parents: any[]): Oid;
        static createV(id: NodeGit.Oid, repo: NodeGit.Repository, update_ref: string, author: NodeGit.Signature, committer: NodeGit.Signature, message_encoding: string, message: string, tree: NodeGit.Tree, parent_count: number): number;
        static lookup(repo: NodeGit.Repository, id: string | Oid | Commit): Promise<NodeGit.Commit>;
        static lookupPrefix(repo: NodeGit.Repository, id: NodeGit.Oid, len: number): Promise<NodeGit.Commit>;

        amend(update_ref: string, author: NodeGit.Signature, committer: NodeGit.Signature, message_encoding: string, message: string, tree: NodeGit.Tree): Oid;
        author(): Signature;
        committer(): Signature;
        free(): void;
        headerField(field: string): Promise<NodeGit.Buf>;
        id(): Oid;
        message(): string;
        messageEncoding(): string;
        messageRaw(): string;
        nthGenAncestor(n: number): Promise<NodeGit.Commit>;
        owner(): Repository;
        parent(n: number): Promise<NodeGit.Commit>;
        parentId(n: number): Oid;
        parentcount(): number;
        rawHeader(): string;
        summary(): string;
        time(): number;
        timeOffset(): number;
        tree(tree_out: NodeGit.Tree): number;
        treeId(): Oid;
        sha(): string;
        timeMs(): number;
        date(): Date;
        getTree(): Promise<NodeGit.Tree>;
        getEntry(path: string): Promise<NodeGit.TreeEntry>;
        history(): EventEmitter;
        getParents(limit: number, callback: Function): Promise<NodeGit.Commit[]>;
        parents(callback: Function): Oid[];
        getDiff(callback: Function): Promise<NodeGit.Diff[]>;
        getDiffWithOptions(options: NodeGit.Object, callback: Function): Promise<NodeGit.Diff[]>;
        toString(): string;
    }

    namespace Config {
        enum LEVEL {
            SYSTEM = 1,
            XDG = 2,
            GLOBAL = 3,
            LOCAL = 4,
            APP = 5,
            HIGHEST_LEVEL = -1
        }
    }

    export class Config {
        static openDefault(): Promise<NodeGit.Config>;

        getStringBuf(name: string): Promise<NodeGit.Buf>;
        setInt64(name: string, value: number): number;
        setMultivar(name: string, regexp: string, value: string): number;
        setString(name: string, value: string): Promise<number>;
        snapshot(): Promise<NodeGit.Config>;
    }

    export class ConfigEntry {
        name: string;
        value: string;
        level: number;
        free: void;
        payload: void;
    }

    namespace Cred {
        enum TYPE {
            USERPASS_PLAINTEXT = 1,
            SSH_KEY = 2,
            SSH_CUSTOM = 4,
            DEFAULT = 8,
            SSH_INTERACTIVE = 16,
            USERNAME = 32,
            SSH_MEMORY = 64
        }
    }

    export class Cred {
        static defaultNew(): Cred;
        static sshKeyFromAgent(username: string): Cred;
        static sshKeyMemoryNew(username: string, publickey: string, privatekey: string, passphrase: string): Promise<NodeGit.Cred>;
        static sshKeyNew(username: string, publickey: string, privatekey: string, passphrase: string): Cred;
        static usernameNew(username: string): Promise<NodeGit.Cred>;
        static userpassPlaintextNew(username: string, password: string): Cred;

        hasUsername(): number;
    }

    export class CredDefault {
    }

    export class CredUsername {
        parent: NodeGit.Cred;
        username: string;
    }

    export class CredUserpassPayload {
        username: string;
        password: string;
    }

    namespace Enums {
        enum CVAR {
            FALSE = 0,
            TRUE = 1,
            INT32 = 2,
            string = 3
        }

        enum DIRECTION {
            FETCH = 0,
            PUSH = 1
        }

        enum FEATURE {
            THREADS = 1,
            HTTPS = 2,
            SSH = 4
        }

        enum IDXENTRY_EXTENDED_FLAG {
            IDXENTRY_INTENT_TO_ADD = 8192,
            IDXENTRY_SKIP_WORKTREE = 16384,
            IDXENTRY_EXTENDED2 = 32768,
            S = 24576,
            IDXENTRY_UPDATE = 1,
            IDXENTRY_REMOVE = 2,
            IDXENTRY_UPTODATE = 4,
            IDXENTRY_ADDED = 8,
            IDXENTRY_HASHED = 16,
            IDXENTRY_UNHASHED = 32,
            IDXENTRY_WT_REMOVE = 64,
            IDXENTRY_CONFLICTED = 128,
            IDXENTRY_UNPACKED = 256,
            IDXENTRY_NEW_SKIP_WORKTREE = 512
        }

        enum INDXENTRY_FLAG {
            IDXENTRY_EXTENDED = 16384,
            IDXENTRY_VALID = 32768
        }
    }

    export class Enums {}

    export class CvarMap {
        cvarType: number;
        strMatch: string;
        mapValue: number;
    }

    namespace Diff {
        enum DELTA {
            UNMODIFIED = 0,
            ADDED = 1,
            DELETED = 2,
            MODIFIED = 3,
            RENAMED = 4,
            COPIED = 5,
            IGNORED = 6,
            UNTRACKED = 7,
            TYPECHANGE = 8,
            UNREADABLE = 9,
            CONFLICTED = 10
        }

        enum FIND {
            BY_CONFIG = 0,
            RENAMES = 1,
            RENAMES_FROM_REWRITES = 2,
            COPIES = 4,
            COPIES_FROM_UNMODIFIED = 8,
            REWRITES = 16,
            BREAK_REWRITES = 32,
            AND_BREAK_REWRITES = 48,
            FOR_UNTRACKED = 64,
            ALL = 255,
            IGNORE_LEADING_WHITESPACE = 0,
            IGNORE_WHITESPACE = 4096,
            DONT_IGNORE_WHITESPACE = 8192,
            EXACT_MATCH_ONLY = 16384,
            BREAK_REWRITES_FOR_RENAMES_ONLY = 32768,
            REMOVE_UNMODIFIED = 65536
        }

        enum FLAG {
            BINARY = 1,
            NOT_BINARY = 2,
            VALID_ID = 4,
            EXISTS = 8
        }

        enum FORMAT {
            PATCH = 1,
            PATCH_HEADER = 2,
            RAW = 3,
            NAME_ONLY = 4,
            NAME_STATUS = 5
        }

        enum FORMAT_EMAIL_FLAGS {
            FORMAT_EMAIL_NONE = 0,
            FORMAT_EMAIL_EXCLUDE_SUBJECT_PATCH_MARKER = 1
        }

        enum LINE {
            CONTEXT = 32,
            ADDITION = 43,
            DELETION = 45,
            CONTEXT_EOFNL = 61,
            ADD_EOFNL = 62,
            DEL_EOFNL = 60,
            FILE_HDR = 70,
            HUNK_HDR = 72,
            BINARY = 66
        }

        enum OPTION {
            NORMAL = 0,
            REVERSE = 1,
            INCLUDE_IGNORED = 2,
            RECURSE_IGNORED_DIRS = 4,
            INCLUDE_UNTRACKED = 8,
            RECURSE_UNTRACKED_DIRS = 16,
            INCLUDE_UNMODIFIED = 32,
            INCLUDE_TYPECHANGE = 64,
            INCLUDE_TYPECHANGE_TREES = 128,
            IGNORE_FILEMODE = 256,
            IGNORE_SUBMODULES = 512,
            IGNORE_CASE = 1024,
            INCLUDE_CASECHANGE = 2048,
            DISABLE_PATHSPEC_MATCH = 4096,
            SKIP_BINARY_CHECK = 8192,
            ENABLE_FAST_UNTRACKED_DIRS = 16384,
            UPDATE_INDEX = 32768,
            INCLUDE_UNREADABLE = 65536,
            INCLUDE_UNREADABLE_AS_UNTRACKED = 131072,
            FORCE_TEXT = 1048576,
            FORCE_BINARY = 2097152,
            IGNORE_WHITESPACE = 4194304,
            IGNORE_WHITESPACE_CHANGE = 8388608,
            IGNORE_WHITESPACE_EOL = 16777216,
            SHOW_UNTRACKED_CONTENT = 33554432,
            SHOW_UNMODIFIED = 67108864,
            PATIENCE = 268435456,
            MINIMAL = 536870912,
            SHOW_BINARY = 1073741824
        }

        enum STATS_FORMAT {
            STATS_NONE = 0,
            STATS_FULL = 1,
            STATS_SHORT = 2,
            STATS_NUMBER = 4,
            STATS_INCLUDE_SUMMARY = 8
        }
    }

    export class Diff {
        static blobToBuffer(old_blob: NodeGit.Blob, old_as_path: string, buffer: string, buffer_as_path: string, opts: NodeGit.DiffOptions, file_cb: Function, binary_cb: Function, hunk_cb: Function, line_cb: Function): Promise<any>;
        static indexToWorkdir(repo: NodeGit.Repository, index: NodeGit.Index, opts: NodeGit.DiffOptions): Promise<NodeGit.Diff>;
        static treeToIndex(repo: NodeGit.Repository, old_tree: NodeGit.Tree, index: NodeGit.Index, opts: NodeGit.DiffOptions): Promise<NodeGit.Diff>;
        static treeToTree(repo: NodeGit.Repository, old_tree: NodeGit.Tree, new_tree: NodeGit.Tree, opts: NodeGit.DiffOptions): Promise<NodeGit.Diff>;
        static treeToWorkdir(repo: NodeGit.Repository, old_tree: NodeGit.Tree, opts: NodeGit.DiffOptions): Promise<NodeGit.Diff>;
        static treeToWorkdirWithIndex(repo: NodeGit.Repository, old_tree: NodeGit.Tree, opts: NodeGit.DiffOptions): Promise<NodeGit.Diff>;

        findSimilar(options: NodeGit.DiffFindOptions): Promise<number>;
        getDelta(idx: number): DiffDelta;
        getPerfdata(): Promise<NodeGit.DiffPerfdata>;
        numDeltas(): number;
        patches(): Promise<any[]>;
    }

    export class DescribeFormatOptions {
        version: number;
        abbreviatedSize: number;
        alwaysUseLongFormat: number;
        dirtySuffix: string;
    }

    export class DescribeOptions {
        version: number;
        maxCandidatesTags: number;
        describeStrategy: number;
        pattern: string;
        onlyFollowFirstParent: number;
        showCommitOidAsFallback: number;
    }

    namespace DiffBinary {
        enum DIFF_BINARY {
            NONE = 0,
            LITERAL = 1,
            DELTA = 2
        }
    }

    export class DiffBinary {
        oldFile: NodeGit.DiffBinaryFile;
        newFile: NodeGit.DiffBinaryFile;
    }

    export class DiffBinaryFile {
        type: number;
        data: string;
        datalen: number;
        inflatedlen: number;
    }

    export class DiffDelta {
        status: number;
        flags: number;
        similarity: number;
        nfiles: number;
        oldFile: NodeGit.DiffFile;
        newFile: NodeGit.DiffFile;
    }

    export class DiffFile {
        flags(): number;
        id(): Oid;
        mode(): number;
        path(): string;
        size(): number;
    }

    export interface DiffFindOptions {
        version: number;
        flags: number;
        renameThreshold: number;
        renameFromRewriteThreshold: number;
        copyThreshold: number;
        breakRewriteThreshold: number;
        renameLimit: number;
    }

    export class DiffHunk {
        oldStart: number;
        oldLines: number;
        newStart: number;
        newLines: number;
        headerLen: number;
        header: string;
    }

    export class DiffLine {
        content(): string;
        origin: number;
        oldLineno: number;
        newLineno: number;
        numLines: number;
        contentLen: number;
        contentOffset: number;
    }

    export interface DiffOptions {
        version: number;
        flags: number;
        ignoreSubmodules: number;
        pathspec: NodeGit.Strarray;
        notifyCb: Function;
        notifyPayload: void;
        contextLines: number;
        interhunkLines: number;
        idAbbrev: number;
        maxSize: number;
        oldPrefix: string;
        newPrefix: string;
    }

    export class DiffPerfdata {
        version: number;
        statCalls: number;
        oidCalculations: number;
    }

    export class DiffStats {
    }

    namespace Error {
        enum ERROR {
            GITERR_NONE = 0,
            GITERR_NOMEMORY = 1,
            GITERR_OS = 2,
            GITERR_INVALID = 3,
            GITERR_REFERENCE = 4,
            GITERR_ZLIB = 5,
            GITERR_REPOSITORY = 6,
            GITERR_CONFIG = 7,
            GITERR_REGEX = 8,
            GITERR_ODB = 9,
            GITERR_INDEX = 10,
            GITERR_OBJECT = 11,
            GITERR_NET = 12,
            GITERR_TAG = 13,
            GITERR_TREE = 14,
            GITERR_INDEXER = 15,
            GITERR_SSL = 16,
            GITERR_SUBMODULE = 17,
            GITERR_THREAD = 18,
            GITERR_STASH = 19,
            GITERR_CHECKOUT = 20,
            GITERR_FETCHHEAD = 21,
            GITERR_MERGE = 22,
            GITERR_SSH = 23,
            GITERR_FILTER = 24,
            GITERR_REVERT = 25,
            GITERR_CALLBACK = 26,
            GITERR_CHERRYPICK = 27,
            GITERR_DESCRIBE = 28,
            GITERR_REBASE = 29,
            GITERR_FILESYSTEM = 30
        }

        enum CODE {
            OK = 0,
            ERROR = -1,
            ENOTFOUND = -3,
            EEXISTS = -4,
            EAMBIGUOUS = -5,
            EBUFS = -6,
            EUSER = -7,
            EBAREREPO = -8,
            EUNBORNBRANCH = -9,
            EUNMERGED = -10,
            ENONFASTFORWARD = -11,
            EINVALIDSPEC = -12,
            ECONFLICT = -13,
            ELOCKED = -14,
            EMODIFIED = -15,
            EAUTH = -16,
            ECERTIFICATE = -17,
            EAPPLIED = -18,
            EPEEL = -19,
            EEOF = -20,
            EINVALID = -21,
            EUNCOMMITTED = -22,
            EDIRECTORY = -23,
            PASSTHROUGH = -30,
            ITEROVER = -31
        }
    }

    export class Error {
        message: string;
        klass: number;
    }

    namespace Fetch {
        enum PRUNE {
            GIT_FETCH_PRUNE_UNSPECIFIED = 0,
            GIT_FETCH_PRUNE = 1,
            GIT_FETCH_NO_PRUNE = 2
        }
    }

    export class Fetch {
        static initOptions(opts: NodeGit.FetchOptions, version: number): number;
    }

    export interface FetchOptions {
        version?: number;
        callbacks?: NodeGit.RemoteCallbacks;
        prune?: number;
        updateFetchhead?: number;
        downloadTags?: number;
    }

    namespace TreeEntry {
        enum FILEMODE {
            UNREADABLE = 0,
            TREE = 16384,
            BLOB = 33188,
            EXECUTABLE = 33261,
            LINK = 40960,
            COMMIT = 57344
        }
    }

    export class TreeEntry {
        isFile(): Boolean;
        isTree(): Boolean;
        isDirectory(): Boolean;
        isBlob(): Boolean;
        sha(): string;
        getTree(): Promise<NodeGit.Tree>;
        getBlob(): Promise<NodeGit.Blob>;
        path(): string;
        toString(): string;
        attr: number;
        oid: NodeGit.Oid;
        filenameLen: number;
        filename: string;
    }

    namespace Filter {
        enum FLAG {
            DEFAULT = 0,
            ALLOW_UNSAFE = 1
        }

        enum MODE {
            TO_WORKTREE = 0,
            SMUDGE = 0,
            TO_ODB = 1,
            CLEAN = 1
        }
    }

    export class Filter {
        static listContains(filters: NodeGit.FilterList, name: string): number;
        static listLength(fl: NodeGit.FilterList): number;
        static listNew(repo: NodeGit.Repository, mode: number, options: number): Promise<NodeGit.FilterList>;
        static listStreamBlob(filters: NodeGit.FilterList, blob: NodeGit.Blob, target: NodeGit.Writestream): number;
        static listStreamData(filters: NodeGit.FilterList, data: NodeGit.Buf, target: NodeGit.Writestream): number;
        static listStreamFile(filters: NodeGit.FilterList, repo: NodeGit.Repository, path: string, target: NodeGit.Writestream): number;
        static unregister(name: string): number;

        lookup(name: string): Filter;
        register(name: string, priority: number): number;
        version: number;
        attributes: string;
        stream: Function;
    }

    export class FilterList {
    }

    export class Giterr {
        static errClear(): void;
        static errDetach(cpy: NodeGit.Error): number;
        static errLast(): Error;
        static errSetOom(): void;
        static errSetString(error_class: number, string: string): void;
    }

    export class Graph {
        static aheadBehind(repo: NodeGit.Repository, local: NodeGit.Oid, upstream: NodeGit.Oid): Promise<number>;
        static descendantOf(repo: NodeGit.Repository, commit: NodeGit.Oid, ancestor: NodeGit.Oid): Promise<number>;
    }

    namespace Hashsig {
        enum OPTION {
            NORMAL = 0,
            IGNORE_WHITESPACE = 1,
            SMART_WHITESPACE = 2,
            ALLOW_SMALL_FILES = 4
        }
    }

    export class Hashsig {
        static create(buf: string, buflen: number, opts: number): Promise<NodeGit.Hashsig>;
        static createFromFile(path: string, opts: number): Promise<NodeGit.Hashsig>;

        compare(b: NodeGit.Hashsig): number;
        free(): void;
    }

    export class Ignore {
        static addRule(repo: NodeGit.Repository, rules: string): number;
        static clearInternalRules(repo: NodeGit.Repository): number;
        static pathIsIgnored(repo: NodeGit.Repository, path: string): Promise<number>;
    }

    namespace Index {
        enum ADD_OPTION {
            ADD_DEFAULT = 0,
            ADD_FORCE = 1,
            ADD_DISABLE_PATHSPEC_MATCH = 2,
            ADD_CHECK_PATHSPEC = 4
        }

        enum CAP {
            IGNORE_CASE = 1,
            NO_FILEMODE = 2,
            NO_SYMLINKS = 4,
            FROM_OWNER = -1
        }
    }

    export class Index {
        static entryIsConflict(entry: NodeGit.IndexEntry): number;
        static entryStage(entry: NodeGit.IndexEntry): number;
        static open(index_path: string): Promise<NodeGit.Index>;

        add(source_entry: NodeGit.IndexEntry): number;
        addAll(pathspec: NodeGit.Strarray, flags: number, callback: Function, payload: void): Promise<number>;
        addByPath(path: string): number;
        caps(): number;
        checksum(): Oid;
        clear(): number;
        conflictAdd(ancestor_entry: NodeGit.IndexEntry, our_entry: NodeGit.IndexEntry, their_entry: NodeGit.IndexEntry): number;
        conflictCleanup(): number;
        conflictGet(path: string): Promise<NodeGit.IndexEntry>;
        conflictRemove(path: string): number;
        entryCount(): number;
        getByIndex(n: number): IndexEntry;
        getByPath(path: string, stage: number): IndexEntry;
        hasConflicts(): number;
        owner(): Repository;
        path(): string;
        read(force: number): number;
        readTree(tree: NodeGit.Tree): number;
        remove(path: string, stage: number): number;
        removeAll(pathspec: NodeGit.Strarray, callback: Function, payload: void): Promise<number>;
        removeByPath(path: string): number;
        removeDirectory(dir: string, stage: number): number;
        setCaps(caps: number): number;
        updateAll(pathspec: NodeGit.Strarray, callback: Function, payload: void): Promise<number>;
        write(): number;
        writeTree(): Promise<NodeGit.Oid>;
        writeTreeTo(repo: NodeGit.Repository): Promise<NodeGit.Oid>;
        entries(): IndexEntry[];
    }

    export class IndexConflictIterator {}

    export interface IndexEntry {
        ctime: NodeGit.IndexTime;
        mtime: NodeGit.IndexTime;
        dev: number;
        ino: number;
        mode: number;
        uid: number;
        gid: number;
        fileSize: number;
        id: NodeGit.Oid;
        flags: number;
        flagsExtended: number;
        path: string;
    }

    export class IndexTime {
        seconds: number;
        nanoseconds: number;
    }

    export class Indexer {
        commit(stats: NodeGit.TransferProgress): number;
        free(): void;
        hash(): Oid;
    }

    namespace Libgit2 {
        enum OPT {
            GET_MWINDOW_SIZE = 0,
            SET_MWINDOW_SIZE = 1,
            GET_MWINDOW_MAPPED_LIMIT = 2,
            SET_MWINDOW_MAPPED_LIMIT = 3,
            GET_SEARCH_PATH = 4,
            SET_SEARCH_PATH = 5,
            SET_CACHE_OBJECT_LIMIT = 6,
            SET_CACHE_MAX_SIZE = 7,
            ENABLE_CACHING = 8,
            GET_CACHED_MEMORY = 9,
            GET_TEMPLATE_PATH = 10,
            SET_TEMPLATE_PATH = 11,
            SET_SSL_CERT_LOCATIONS = 12
        }
    }

    export class Libgit2 {
        static features(): number;
        static init(): number;
        static opts(option: number): number;
        static shutdown(): number;
        static version(major: number, minor: number, rev: number): void;
    }

    export class Mempack {}

    namespace Merge {
        enum ANALYSIS {
            NONE = 0,
            NORMAL = 1,
            UP_TO_DATE = 2,
            FASTFORWARD = 4,
            UNBORN = 8
        }

        enum FILE_FAVOR {
            NORMAL = 0,
            OURS = 1,
            THEIRS = 2,
            UNION = 3
        }

        enum FILE_FLAGS {
            FILE_DEFAULT = 0,
            FILE_STYLE_MERGE = 1,
            FILE_STYLE_DIFF3 = 2,
            FILE_SIMPLIFY_ALNUM = 4,
            FILE_IGNORE_WHITESPACE = 8,
            FILE_IGNORE_WHITESPACE_CHANGE = 16,
            FILE_IGNORE_WHITESPACE_EOL = 32,
            FILE_DIFF_PATIENCE = 64,
            FILE_DIFF_MINIMAL = 128
        }

        enum PREFERENCE {
            NONE = 0,
            NO_FASTFORWARD = 1,
            FASTFORWARD_ONLY = 2
        }

        enum TREE_FLAG {
            TREE_FIND_RENAMES = 1
        }
    }

    export class Merge {
        static merge(repo: NodeGit.Repository, theirHead: NodeGit.AnnotatedCommit, mergeOpts?: NodeGit.MergeOptions, checkoutOpts?: NodeGit.CheckoutOptions): any;
        static base(repo: NodeGit.Repository, one: NodeGit.Oid, two: NodeGit.Oid): Promise<NodeGit.Oid>;
        static bases(repo: NodeGit.Repository, one: NodeGit.Oid, two: NodeGit.Oid): Promise<NodeGit.Oidarray>;
        static commits(repo: NodeGit.Repository, ourCommit: NodeGit.Commit, theirCommit: NodeGit.Commit, options?: NodeGit.MergeOptions): any;
        static fileInitInput(opts: NodeGit.MergeFileInput, version: number): number;
        static initOptions(opts: NodeGit.MergeOptions, version: number): number;
        static trees(repo: NodeGit.Repository, ancestor_tree: NodeGit.Tree, our_tree: NodeGit.Tree, their_tree: NodeGit.Tree, opts: NodeGit.MergeOptions): Promise<NodeGit.Index>;
    }

    export interface MergeFileInput {
        version: number;
        ptr: string;
        size: number;
        path: string;
        mode: number;
    }

    export interface MergeFileOptions {
        version: number;
        ancestorLabel: string;
        ourLabel: string;
        theirLabel: string;
        favor: number;
        flags: number;
    }

    export class MergeFileResult {
        automergeable: number;
        path: string;
        mode: number;
        ptr: string;
        len: number;
    }

    export interface MergeOptions {
        version: number;
        treeFlags: number;
        renameThreshold: number;
        targetLimit: number;
        fileFavor: number;
        fileFlags: number;
    }

    export class MergeResult {
    }

    export class Message {
    }

    export class Note {
        static create(repo: NodeGit.Repository, notes_ref: string, author: NodeGit.Signature, committer: NodeGit.Signature, oid: NodeGit.Oid, note: string, force: number): Promise<NodeGit.Oid>;
        static foreach(repo: NodeGit.Repository, notes_ref: string, note_cb: Function, payload: void): Promise<number>;
        static iteratorNew(repo: NodeGit.Repository, notes_ref: string): Promise<NodeGit.NoteIterator>;
        static next(note_id: NodeGit.Oid, annotated_id: NodeGit.Oid, it: NodeGit.NoteIterator): number;
        static read(repo: NodeGit.Repository, notes_ref: string, oid: NodeGit.Oid): Promise<NodeGit.Note>;
        static remove(repo: NodeGit.Repository, notes_ref: string, author: NodeGit.Signature, committer: NodeGit.Signature, oid: NodeGit.Oid): Promise<number>;

        author(): Signature;
        committer(): Signature;
        free(): void;
        id(): Oid;
        message(): string;
    }

    export class NoteIterator {}

    namespace Object {
        enum TYPE {
            ANY = -2,
            BAD = -1,
            EXT1 = 0,
            COMMIT = 1,
            TREE = 2,
            BLOB = 3,
            TAG = 4,
            EXT2 = 5,
            OFS_DELTA = 6,
            REF_DELTA = 7
        }
    }

    export class Object {
        static size(type: number): number;
        static lookup(repo: NodeGit.Repository, id: NodeGit.Oid, type: number): Promise<NodeGit.Object>;
        static lookupPrefix(repo: NodeGit.Repository, id: NodeGit.Oid, len: number, type: number): Promise<NodeGit.Object>;
        static string2type(str: string): number;
        static type2string(type: number): string;
        static typeisloose(type: number): number;

        dup(): Promise<NodeGit.Object>;
        free(): void;
        id(): Oid;
        lookupByPath(path: string, type: number): Promise<NodeGit.Object>;
        owner(): Repository;
        peel(target_type: number): Promise<NodeGit.Object>;
        shortId(): Promise<NodeGit.Buf>;
        type(): number;
    }

    namespace Odb {
        enum STREAM {
            RDONLY = 2,
            WRONLY = 4,
            RW = 6
        }
    }

    export class Odb {
        static open(objects_dir: string): Promise<NodeGit.Odb>;

        addDiskAlternate(path: string): number;
        free(): void;
        read(id: NodeGit.Oid): Promise<NodeGit.OdbObject>;
        write(data: Buffer, len: number, type: number): Promise<NodeGit.Oid>;
    }

    export class OdbObject {
        data(): Buffer;
        dup(): Promise<NodeGit.OdbObject>;
        free(): void;
        id(): Oid;
        size(): number;
        type(): number;
    }

    export class Oid {
        static fromString(str: string): Oid;
        cmp(b: NodeGit.Oid): number;
        cpy(): Oid;
        equal(b: NodeGit.Oid): number;
        iszero(): number;
        ncmp(b: NodeGit.Oid, len: number): number;
        strcmp(str: string): number;
        streq(str: string): number;
        tostrS(): string;
    }

    export class OidShorten {
    }

    export class Oidarray {
            free(): void;
            ids: NodeGit.Oid;
            count: number;
    }

    export class Openssl {
        static setLocking(): number;
    }

    namespace Packbuilder {
        enum STAGE {
            ADDING_OBJECTS = 0,
            DELTAFICATION = 1
        }
    }

    export class Packbuilder {
        static create(repo: NodeGit.Repository): Packbuilder;

        free(): void;
        hash(): Oid;
        insert(id: NodeGit.Oid, name: string): number;
        insertCommit(id: NodeGit.Oid): number;
        insertRecur(id: NodeGit.Oid, name: string): number;
        insertTree(id: NodeGit.Oid): number;
        insertWalk(walk: NodeGit.Revwalk): number;
        objectCount(): number;
        setThreads(n: number): number;
        written(): number;
    }

    export class Patch {
        static fromBlobAndBuffer(old_blob: NodeGit.Blob, old_as_path: string, buffer: string, buffer_len: number, buffer_as_path: string, opts: NodeGit.DiffOptions): Promise<NodeGit.Patch>;
        static fromBlobs(old_blob: NodeGit.Blob, old_as_path: string, new_blob: NodeGit.Blob, new_as_path: string, opts: NodeGit.DiffOptions): Promise<NodeGit.Patch>;
        static fromDiff(diff: NodeGit.Diff, idx: number): Promise<NodeGit.Patch>;
        static convenientFromDiff(diff: NodeGit.Diff): Promise<any>;

        getDelta(): DiffDelta;
        getHunk(hunk_idx: number): Promise<number>;
        getLineInHunk(hunk_idx: number, line_of_hunk: number): Promise<NodeGit.DiffLine>;
        lineStats(): number;
        numHunks(): number;
        numLinesInHunk(hunk_idx: number): number;
        size(include_context: number, include_hunk_headers: number, include_file_headers: number): number;
    }

    namespace Pathspec {
        enum FLAG {
            DEFAULT = 0,
            IGNORE_CASE = 1,
            USE_CASE = 2,
            NO_GLOB = 4,
            NO_MATCH_ERROR = 8,
            FIND_FAILURES = 16,
            FAILURES_ONLY = 32
        }
    }

    export class Pathspec {
        static matchListDiffEntry(m: NodeGit.PathspecMatchList, pos: number): DiffDelta;
        static matchListEntry(m: NodeGit.PathspecMatchList, pos: number): string;
        static matchListEntrycount(m: NodeGit.PathspecMatchList): number;
        static matchListFailedEntry(m: NodeGit.PathspecMatchList, pos: number): string;
        static matchListFailedEntrycount(m: NodeGit.PathspecMatchList): number;
        static create(pathspec: NodeGit.Strarray): Pathspec;

        free(): void;
        matchDiff(diff: NodeGit.Diff, flags: number): Promise<NodeGit.PathspecMatchList>;
        matchIndex(index: NodeGit.Index, flags: number): Promise<NodeGit.PathspecMatchList>;
        matchTree(tree: NodeGit.Tree, flags: number): Promise<NodeGit.PathspecMatchList>;
        matchWorkdir(repo: NodeGit.Repository, flags: number): Promise<NodeGit.PathspecMatchList>;
        matchesPath(flags: number, path: string): number;
    }

    export class PathspecMatchList {
    }

    export class Push {
        static initOptions(opts: NodeGit.PushOptions, version: number): number;
    }

    export interface PushOptions {
        version: number;
        pbParallelism: number;
        callbacks: NodeGit.RemoteCallbacks;
    }

    export class PushUpdate {
        srcRefname: string;
        dstRefname: string;
        src: NodeGit.Oid;
        dst: NodeGit.Oid;
    }

    export class Rebase {
        static init(repo: NodeGit.Repository, branch: NodeGit.AnnotatedCommit, upstream: NodeGit.AnnotatedCommit, onto: NodeGit.AnnotatedCommit, opts: NodeGit.RebaseOptions): Promise<NodeGit.Rebase>;
        static initOptions(opts: NodeGit.RebaseOptions, version: number): number;
        static open(repo: NodeGit.Repository, opts: NodeGit.RebaseOptions): Promise<NodeGit.Rebase>;

        abort(): number;
        commit(author: NodeGit.Signature, committer: NodeGit.Signature, message_encoding: string, message: string): Oid;
        finish(signature: NodeGit.Signature): number;
        next(): Promise<NodeGit.RebaseOperation>;
        operationByIndex(idx: number): RebaseOperation;
        operationCurrent(): number;
        operationEntrycount(): number;
    }

    namespace RebaseOperation {
        enum REBASE_OPERATION {
            PICK = 0,
            REWORD = 1,
            EDIT = 2,
            SQUASH = 3,
            FIXUP = 4,
            EXEC = 5
        }
    }

    export class RebaseOperation {
        type: number;
        id: NodeGit.Oid;
        exec: string;
    }

    export interface RebaseOptions {
        version: number;
        quiet: number;
        rewriteNotesRef: string;
        checkoutOptions: NodeGit.CheckoutOptions;
    }

    namespace Reference {
        enum TYPE {
            INVALID = 0,
            OID = 1,
            SYMBOLIC = 2,
            LISTALL = 3
        }

        enum NORMALIZE {
            REF_FORMAT_NORMAL = 0,
            REF_FORMAT_ALLOW_ONELEVEL = 1,
            REF_FORMAT_REFSPEC_PATTERN = 2,
            REF_FORMAT_REFSPEC_SHORTHAND = 4
        }
    }

    export class Reference {
        static create(repo: NodeGit.Repository, name: string, id: NodeGit.Oid, force: number, log_message: string): Promise<NodeGit.Reference>;
        static createMatching(repo: NodeGit.Repository, name: string, id: NodeGit.Oid, force: number, current_id: NodeGit.Oid, log_message: string): Promise<NodeGit.Reference>;
        static dwim(repo: NodeGit.Repository, id: string | Reference, callback: Function): Promise<NodeGit.Reference>;
        static ensureLog(repo: NodeGit.Repository, refname: string): number;
        static hasLog(repo: NodeGit.Repository, refname: string): number;
        static isValidName(refname: string): number;
        static list(repo: NodeGit.Repository): Promise<any[]>;
        static lookup(repo: NodeGit.Repository, id: string | Reference, callback: Function): Promise<NodeGit.Reference>;
        static nameToId(repo: NodeGit.Repository, name: string): Promise<NodeGit.Oid>;
        static normalizeName(buffer_out: string, buffer_size: number, name: string, flags: number): number;
        static remove(repo: NodeGit.Repository, name: string): number;
        static symbolicCreate(repo: NodeGit.Repository, name: string, target: string, force: number, log_message: string): Promise<NodeGit.Reference>;
        static symbolicCreateMatching(repo: NodeGit.Repository, name: string, target: string, force: number, current_value: string, log_message: string): Promise<NodeGit.Reference>;

        cmp(ref2: NodeGit.Reference): number;
        delete(): number;
        isBranch(): number;
        isNote(): number;
        isRemote(): number;
        isTag(): number;
        name(): string;
        owner(): Repository;
        peel(type: number): Promise<NodeGit.Object>;
        rename(new_name: string, force: number, log_message: string): Promise<NodeGit.Reference>;
        resolve(): Promise<NodeGit.Reference>;
        setTarget(id: NodeGit.Oid, log_message: string): Promise<NodeGit.Reference>;
        shorthand(): string;
        symbolicSetTarget(target: string, log_message: string): Promise<NodeGit.Reference>;
        symbolicTarget(): string;
        target(): Oid;
        targetPeel(): Oid;
        type(): number;
        isValid(): Boolean;
        isConcrete(): Boolean;
        isSymbolic(): Boolean;
        toString(): string;
        isHead(): boolean;
    }

    export class Refdb {
        static open(repo: NodeGit.Repository): Promise<NodeGit.Refdb>;

        compress(): number;
        free(): void;
    }

    export class Reflog {
        static delete(repo: NodeGit.Repository, name: string): number;
        static entryCommitter(entry: NodeGit.ReflogEntry): Signature;
        static entryIdNew(entry: NodeGit.ReflogEntry): Oid;
        static entryIdOld(entry: NodeGit.ReflogEntry): Oid;
        static entryMessage(entry: NodeGit.ReflogEntry): string;
        static read(repo: NodeGit.Repository, name: string): Promise<NodeGit.Reflog>;
        static rename(repo: NodeGit.Repository, old_name: string, name: string): number;

        append(id: NodeGit.Oid, committer: NodeGit.Signature, msg: string): number;
        drop(idx: number, rewrite_previous_entry: number): number;
        entryByIndex(idx: number): ReflogEntry;
        entrycount(): number;
        free(): void;
        write(): number;
    }

    export class ReflogEntry {
    }

    export class Refspec {
        direction(): number;
        dst(): string;
        dstMatches(refname: string): number;
        force(): number;
        src(): string;
        srcMatches(refname: string): number;
    }

    namespace Remote {
        enum AUTOTAG_OPTION {
            DOWNLOAD_TAGS_UNSPECIFIED = 0,
            DOWNLOAD_TAGS_AUTO = 1,
            DOWNLOAD_TAGS_NONE = 2,
            DOWNLOAD_TAGS_ALL = 3
        }

        enum COMPLETION_TYPE {
            COMPLETION_DOWNLOAD = 0,
            COMPLETION_INDEXING = 1,
            COMPLETION_ERROR = 2
        }
    }

    export class Remote {
        static addFetch(repo: NodeGit.Repository, remote: string, refspec: string): number;
        static addPush(repo: NodeGit.Repository, remote: string, refspec: string): number;
        static create(repo: NodeGit.Repository, name: string, url: string): Remote;
        static createAnonymous(repo: NodeGit.Repository, url: string): Promise<NodeGit.Remote>;
        static createWithFetchspec(repo: NodeGit.Repository, name: string, url: string, fetch: string): Promise<NodeGit.Remote>;
        static delete(repo: NodeGit.Repository, name: string): Promise<number>;
        static initCallbacks(opts: NodeGit.RemoteCallbacks, version: number): number;
        static isValidName(remote_name: string): number;
        static list(repo: NodeGit.Repository): Promise<any[]>;
        static lookup(repo: NodeGit.Repository, name: string | Remote, callback: Function): Promise<NodeGit.Remote>;
        static setAutotag(repo: NodeGit.Repository, remote: string, value: number): number;
        static setPushurl(repo: NodeGit.Repository, remote: string, url: string): number;
        static setUrl(repo: NodeGit.Repository, remote: string, url: string): number;

        autotag(): number;
        connect(direction: NodeGit.Enums.DIRECTION, callbacks: NodeGit.RemoteCallbacks, callback: Function): Promise<number>;
        connected(): number;
        defaultBranch(): Promise<NodeGit.Buf>;
        disconnect(): Promise<void>;
        download(refSpecs: any[], opts: NodeGit.FetchOptions, callback: Function): Promise<number>;
        dup(): Promise<NodeGit.Remote>;
        fetch(refSpecs: any[], opts: NodeGit.FetchOptions, message: string, callback: Function): Promise<number>;
        free(): void;
        getFetchRefspecs(): Promise<any[]>;
        getPushRefspecs(): Promise<any[]>;
        getRefspec(n: number): Refspec;
        name(): string;
        owner(): Repository;
        prune(callbacks: NodeGit.RemoteCallbacks): number;
        pruneRefs(): number;
        push(refSpecs: any[], options: NodeGit.PushOptions, callback: Function): Promise<number>;
        pushurl(): string;
        refspecCount(): number;
        stats(): TransferProgress;
        stop(): void;
        updateTips(callbacks: NodeGit.RemoteCallbacks, update_fetchhead: number, download_tags: number, reflog_message: string): number;
        upload(refspecs: NodeGit.Strarray, opts: NodeGit.PushOptions): number;
        url(): string;
    }

    export interface RemoteCallbacks {
        version?: number;
        credentials?: Function;
        certificateCheck?: Function;
        transferProgress?: Function;
        transport?: Function;
        payload?: void;
    }

    namespace Repository {
        enum INIT_FLAG {
            BARE = 1,
            NO_REINIT = 2,
            NO_DOTGIT_DIR = 4,
            MKDIR = 8,
            MKPATH = 16,
            EXTERNAL_TEMPLATE = 32,
            RELATIVE_GITLINK = 64
        }

        enum INIT_MODE {
            INIT_SHARED_UMASK = 0,
            INIT_SHARED_GROUP = 1533,
            INIT_SHARED_ALL = 1535
        }

        enum OPEN_FLAG {
            OPEN_NO_SEARCH = 1,
            OPEN_CROSS_FS = 2,
            OPEN_BARE = 4
        }

        enum STATE {
            NONE = 0,
            MERGE = 1,
            REVERT = 2,
            CHERRYPICK = 3,
            BISECT = 4,
            REBASE = 5,
            REBASE_INTERACTIVE = 6,
            REBASE_MERGE = 7,
            APPLY_MAILBOX = 8,
            APPLY_MAILBOX_OR_REBASE = 9
        }
    }

    export class Repository {
        static discover(start_path: string, across_fs: number, ceiling_dirs: string): Promise<NodeGit.Buf>;
        static init(path: string, is_bare: number): Promise<NodeGit.Repository>;
        static initExt(repo_path: string, opts: NodeGit.RepositoryInitOptions): Promise<NodeGit.Repository>;
        static open(path: string): Promise<NodeGit.Repository>;
        static openBare(bare_path: string): Promise<NodeGit.Repository>;
        static openExt(path: string, flags: number, ceiling_dirs: string): Promise<NodeGit.Repository>;
        static wrapOdb(odb: NodeGit.Odb): Promise<NodeGit.Repository>;

        cleanup(): void;
        config(): Promise<NodeGit.Config>;
        configSnapshot(): Promise<NodeGit.Config>;
        detachHead(): number;
        fetchheadForeach(callback: Function): Promise<any>;
        free(): void;
        getNamespace(): string;
        head(): Promise<NodeGit.Reference>;
        headDetached(): number;
        headUnborn(): number;
        index(): Promise<NodeGit.Index>;
        isBare(): number;
        isEmpty(): number;
        isShallow(): number;
        mergeheadForeach(callback: Function): Promise<any>;
        messageRemove(): number;
        odb(): Promise<NodeGit.Odb>;
        path(): string;
        refdb(): Promise<NodeGit.Refdb>;
        setHead(refname: string): Promise<number>;
        setHeadDetached(commitish: NodeGit.Oid): number;
        setHeadDetachedFromAnnotated(commitish: NodeGit.AnnotatedCommit): number;
        setIdent(name: string, email: string): number;
        setNamespace(nmspace: string): number;
        setWorkdir(workdir: string, update_gitlink: number): number;
        state(): number;
        stateCleanup(): number;
        workdir(): string;
        createBranch(name: string, commit: NodeGit.Commit | string | Oid, force: boolean, signature: NodeGit.Signature, logMessage: string): Promise<NodeGit.Reference>;
        getReferenceCommit(name: string | Reference): Promise<NodeGit.Commit>;
        getBranch(name: string | Reference): Promise<NodeGit.Reference>;
        getBranchCommit(name: string | Reference): Promise<NodeGit.Commit>;
        getCurrentBranch(): Promise<NodeGit.Reference>;
        getReference(name: string | Reference): Promise<NodeGit.Reference>;
        getReferences(type: NodeGit.Reference.TYPE): Promise<NodeGit.Reference[]>;
        getReferenceNames(type: NodeGit.Reference.TYPE): Promise<string[]>;
        getCommit(string: string | Oid): Promise<NodeGit.Commit>;
        getBlob(string: string | Oid): Promise<NodeGit.Blob>;
        getTree(string: string | Oid): Promise<NodeGit.Tree>;
        createTag(string: string | Oid, name: string, message: string): Promise<NodeGit.Tag>;
        createLightweightTag(string: string | Oid, name: string): Promise<NodeGit.Reference>;
        getTag(string: string | Oid): Promise<NodeGit.Tag>;
        getTagByName(Short: string): Promise<NodeGit.Tag>;
        deleteTagByName(Short: string): Promise<any>;
        createRevWalk(string: string | Oid): any;
        getMasterCommit(): Promise<NodeGit.Commit>;
        getHeadCommit(): Promise<NodeGit.Commit>;
        createCommit(updateRef: string, author: NodeGit.Signature, committer: NodeGit.Signature, message: string, Tree: NodeGit.Tree | Oid | string, parents: any[]): Promise<NodeGit.Oid>;
        createCommitOnHead(filesToAdd: any[], author: NodeGit.Signature, committer: NodeGit.Signature, message: string): Promise<NodeGit.Oid>;
        createBlobFromBuffer(buffer: Buffer): Oid;
        treeBuilder(tree: NodeGit.Tree): any;
        defaultSignature(): Signature;
        getRemotes(Optional: Function): Promise<NodeGit.Object>;
        getRemote(remote: string | Remote, callback: Function): Promise<NodeGit.Remote>;
        fetch(remote: string | Remote, fetchOptions: NodeGit.Object | FetchOptions): Promise<any>;
        fetchAll(fetchOptions: NodeGit.Object | FetchOptions, callback: Function): Promise<any>;
        mergeBranches(to: string | Reference, from: string | Reference, signature: NodeGit.Signature, mergePreference: NodeGit.Merge.PREFERENCE, mergeOptions: NodeGit.MergeOptions): Promise<NodeGit.Oid>;
        rebaseBranches(branch: string, upstream: string, onto: string, signature: NodeGit.Signature, beforeNextFn: Function): Promise<NodeGit.Oid>;
        continueRebase(signature: NodeGit.Signature, beforeNextFn: Function): Promise<NodeGit.Oid>;
        getStatus(opts: any): Promise<any[]>;
        getStatusExt(opts: any): Promise<any[]>;
        getSubmoduleNames(): Promise<string[]>;
        checkoutRef(reference: NodeGit.Reference, opts: NodeGit.Object | CheckoutOptions): Promise<any>;
        checkoutBranch(branch: string | Reference, opts: NodeGit.Object | CheckoutOptions): Promise<any>;
        stageFilemode(filePath: string | any[], stageNew: Boolean): Promise<number>;
        stageLines(filePath: string, newLines: any[], isStaged: Boolean): Promise<number>;
        isDefaultState(): Boolean;
        isApplyingMailbox(): Boolean;
        isBisecting(): Boolean;
        isCherrypicking(): Boolean;
        isMerging(): Boolean;
        isRebasing(): Boolean;
        isReverting(): Boolean;
    }

    export interface RepositoryInitOptions {
        version: number;
        flags: number;
        mode: number;
        workdirPath: string;
        description: string;
        templatePath: string;
        initialHead: string;
        originUrl: string;
    }

    namespace Reset {
        enum TYPE {
            SOFT = 1,
            MIXED = 2,
            HARD = 3
        }
    }

    export class Reset {
        static reset(repo: NodeGit.Repository, target: NodeGit.Object, reset_type: number, checkout_opts: NodeGit.CheckoutOptions): Promise<number>;
        static default(repo: NodeGit.Repository, target: NodeGit.Object, pathspecs: NodeGit.Strarray): Promise<number>;
        static fromAnnotated(repo: NodeGit.Repository, commit: NodeGit.AnnotatedCommit, reset_type: number, checkout_opts: NodeGit.CheckoutOptions): number;
    }

    export class Revert {
        static revert(repo: NodeGit.Repository, commit: NodeGit.Commit, given_opts: NodeGit.RevertOptions): Promise<number>;
        static commit(repo: NodeGit.Repository, revert_commit: NodeGit.Commit, our_commit: NodeGit.Commit, mainline: number, merge_options: NodeGit.MergeOptions): Promise<NodeGit.Index>;
    }

    export interface RevertOptions {
        version: number;
        mainline: number;
        mergeOpts: NodeGit.MergeOptions;
        checkoutOpts: NodeGit.CheckoutOptions;
    }

    namespace Revparse {
        enum MODE {
            SINGLE = 1,
            RANGE = 2,
            MERGE_BASE = 4
        }
    }

    export class Revparse {
        static ext(object_out: NodeGit.Object, reference_out: NodeGit.Reference, repo: NodeGit.Repository, spec: string): number;
        static single(repo: NodeGit.Repository, spec: string): Promise<NodeGit.Object>;
    }

    namespace Revwalk {
        enum SORT {
            NONE = 0,
            TOPOLOGICAL = 1,
            TIME = 2,
            REVERSE = 4
        }
    }

    export class Revwalk {
        static create(repo: NodeGit.Repository): Revwalk;

        hide(commit_id: NodeGit.Oid): number;
        hideGlob(glob: string): number;
        hideHead(): number;
        hideRef(refname: string): number;
        next(): Promise<NodeGit.Oid>;
        push(id: NodeGit.Oid): number;
        pushGlob(glob: string): number;
        pushHead(): number;
        pushRange(range: string): number;
        pushRef(refname: string): number;
        repository(): Repository;
        reset(): void;
        simplifyFirstParent(): void;
        sorting(sort: number): any;
        fastWalk(max_count: number): Promise<any>;
        fileHistoryWalk(filePath: string, max_count: number): Promise<any[]>;
        walk(oid: NodeGit.Oid, callback: Function): Commit;
        getCommitsUntil(checkFn: Function): Promise<any[]>;
        getCommits(count: number): Promise<NodeGit.Commit[]>;
    }

    export class Signature {
        static default(repo: NodeGit.Repository): Signature;
        static create(name: string, email: string, time: number, offset: number): Signature;
        static now(name: string, email: string): Signature;

        dup(): Promise<NodeGit.Signature>;
        free(): void;
        toString(): string;
        name: string;
        email: string;
        when: NodeGit.Time;
    }

    export class Smart {}

    namespace Stash {
        enum APPLY_FLAGS {
            APPLY_DEFAULT = 0,
            APPLY_REINSTATE_INDEX = 1
        }

        enum APPLY_PROGRESS {
            NONE = 0,
            LOADING_STASH = 1,
            ANALYZE_INDEX = 2,
            ANALYZE_MODIFIED = 3,
            ANALYZE_UNTRACKED = 4,
            CHECKOUT_UNTRACKED = 5,
            CHECKOUT_MODIFIED = 6,
            DONE = 7
        }

        enum FLAGS {
            DEFAULT = 0,
            KEEP_INDEX = 1,
            INCLUDE_UNTRACKED = 2,
            INCLUDE_IGNORED = 4
        }
    }

    export class Stash {
        static apply(repo: NodeGit.Repository, index: number, options: NodeGit.StashApplyOptions): Promise<number>;
        static applyInitOptions(opts: NodeGit.StashApplyOptions, version: number): number;
        static drop(repo: NodeGit.Repository, index: number): Promise<number>;
        static foreach(repo: NodeGit.Repository, callback: Function, payload: void): Promise<number>;
        static pop(repo: NodeGit.Repository, index: number, options: NodeGit.StashApplyOptions): Promise<number>;
        static save(repo: NodeGit.Repository, stasher: NodeGit.Signature, message: string, flags: number): Promise<NodeGit.Oid>;
    }

    export interface StashApplyOptions {
        version: number;
        flags: number;
        checkoutOptions: NodeGit.CheckoutOptions;
        progressCb: Function;
        progressPayload: void;
    }

    namespace Status {
        enum STATUS {
            CURRENT = 0,
            INDEX_NEW = 1,
            INDEX_MODIFIED = 2,
            INDEX_DELETED = 4,
            INDEX_RENAMED = 8,
            INDEX_TYPECHANGE = 16,
            WT_NEW = 128,
            WT_MODIFIED = 256,
            WT_DELETED = 512,
            WT_TYPECHANGE = 1024,
            WT_RENAMED = 2048,
            WT_UNREADABLE = 4096,
            IGNORED = 16384,
            CONFLICTED = 32768
        }

        enum OPT {
            INCLUDE_UNTRACKED = 1,
            INCLUDE_IGNORED = 2,
            INCLUDE_UNMODIFIED = 4,
            EXCLUDE_SUBMODULES = 8,
            RECURSE_UNTRACKED_DIRS = 16,
            DISABLE_PATHSPEC_MATCH = 32,
            RECURSE_IGNORED_DIRS = 64,
            RENAMES_HEAD_TO_INDEX = 128,
            RENAMES_INDEX_TO_WORKDIR = 256,
            SORT_CASE_SENSITIVELY = 512,
            SORT_CASE_INSENSITIVELY = 1024,
            RENAMES_FROM_REWRITES = 2048,
            NO_REFRESH = 4096,
            UPDATE_INDEX = 8192,
            INCLUDE_UNREADABLE = 16384,
            INCLUDE_UNREADABLE_AS_UNTRACKED = 32768
        }

        enum SHOW {
            INDEX_AND_WORKDIR = 0,
            INDEX_ONLY = 1,
            WORKDIR_ONLY = 2
        }
    }

    export class Status {
        static byIndex(statuslist: NodeGit.StatusList, idx: number): StatusEntry;
        static file(repo: NodeGit.Repository, path: string): number;
        static foreach(repo: NodeGit.Repository, callback: Function, payload: void): Promise<number>;
        static foreachExt(repo: NodeGit.Repository, opts: NodeGit.StatusOptions, callback: Function, payload: void): Promise<number>;
        static shouldIgnore(ignored: number, repo: NodeGit.Repository, path: string): number;
    }

    export class StatusEntry {
        status: number;
        headToIndex: NodeGit.DiffDelta;
        indexToWorkdir: NodeGit.DiffDelta;
    }

    export class StatusList {
        static create(repo: NodeGit.Repository, opts: NodeGit.StatusOptions): Promise<NodeGit.StatusList>;

        entrycount(): number;
        free(): void;
        getPerfdata(): Promise<NodeGit.DiffPerfdata>;
    }

    export interface StatusOptions {
        version: number;
        show: number;
        flags: number;
        pathspec: NodeGit.Strarray;
    }

    export class Strarray {
        copy(src: NodeGit.Strarray): number;
        free(): void;
        strings: string;
        count: number;
    }

    namespace Submodule {
        enum IGNORE {
            UNSPECIFIED = -1,
            NONE = 1,
            UNTRACKED = 2,
            DIRTY = 3,
            ALL = 4
        }

        enum RECURSE {
            NO = 0,
            YES = 1,
            ONDEMAND = 2
        }

        enum STATUS {
            IN_HEAD = 1,
            IN_INDEX = 2,
            IN_CONFIG = 4,
            IN_WD = 8,
            INDEX_ADDED = 16,
            INDEX_DELETED = 32,
            INDEX_MODIFIED = 64,
            WD_UNINITIALIZED = 128,
            WD_ADDED = 256,
            WD_DELETED = 512,
            WD_MODIFIED = 1024,
            WD_INDEX_MODIFIED = 2048,
            WD_WD_MODIFIED = 4096,
            WD_UNTRACKED = 8192
        }

        enum UPDATE {
            CHECKOUT = 1,
            REBASE = 2,
            MERGE = 3,
            NONE = 4,
            DEFAULT = 0
        }
    }

    export class Submodule {
        static addSetup(repo: NodeGit.Repository, url: string, path: string, use_gitlink: number): Promise<NodeGit.Submodule>;
        static foreach(repo: NodeGit.Repository, callback: Function, payload: void): Promise<number>;
        static lookup(repo: NodeGit.Repository, name: string): Promise<NodeGit.Submodule>;
        static resolveUrl(repo: NodeGit.Repository, url: string): Promise<NodeGit.Buf>;
        static setBranch(repo: NodeGit.Repository, name: string, branch: string): number;
        static setFetchRecurseSubmodules(repo: NodeGit.Repository, name: string, fetch_recurse_submodules: number): number;
        static setIgnore(repo: NodeGit.Repository, name: string, ignore: number): Promise<number>;
        static setUpdate(repo: NodeGit.Repository, name: string, update: number): Promise<number>;
        static setUrl(repo: NodeGit.Repository, name: string, url: string): Promise<number>;
        static status(repo: NodeGit.Repository, name: string, ignore: number): Promise<number>;
        static updateInitOptions(opts: NodeGit.SubmoduleUpdateOptions, version: number): number;

        addFinalize(): Promise<number>;
        addToIndex(write_index: number): Promise<number>;
        branch(): string;
        fetchRecurseSubmodules(): number;
        free(): void;
        headId(): Oid;
        ignore(): number;
        indexId(): Oid;
        init(overwrite: number): Promise<number>;
        location(): Promise<number>;
        name(): string;
        open(): Promise<NodeGit.Repository>;
        owner(): Repository;
        path(): string;
        reload(force: number): number;
        repoInit(use_gitlink: number): Promise<NodeGit.Repository>;
        sync(): Promise<number>;
        update(init: number, options: NodeGit.SubmoduleUpdateOptions): Promise<number>;
        updateStrategy(): number;
        url(): string;
        wdId(): Oid;
    }

    export interface SubmoduleUpdateOptions {
        version: number;
        checkoutOpts: NodeGit.CheckoutOptions;
        fetchOpts: NodeGit.FetchOptions;
        cloneCheckoutStrategy: number;
    }

    export class Tag {
        static annotationCreate(repo: NodeGit.Repository, tag_name: string, target: NodeGit.Object, tagger: NodeGit.Signature, message: string): Promise<NodeGit.Oid>;
        static create(repo: NodeGit.Repository, tag_name: string, target: NodeGit.Object, tagger: NodeGit.Signature, message: string, force: number): Promise<NodeGit.Oid>;
        static createLightweight(repo: NodeGit.Repository, tag_name: string, target: NodeGit.Object, force: number): Promise<NodeGit.Oid>;
        static delete(repo: NodeGit.Repository, tag_name: string): Promise<number>;
        static list(repo: NodeGit.Repository): Promise<any[]>;
        static listMatch(tag_names: NodeGit.Strarray, pattern: string, repo: NodeGit.Repository): number;
        static lookup(repo: NodeGit.Repository, id: string | Oid | Tag): Promise<NodeGit.Tag>;
        static lookupPrefix(repo: NodeGit.Repository, id: NodeGit.Oid, len: number): Promise<NodeGit.Tag>;

        free(): void;
        id(): Oid;
        message(): string;
        name(): string;
        owner(): Repository;
        peel(tag_target_out: NodeGit.Object): number;
        tagger(): Signature;
        target(): Object;
        targetId(): Oid;
        targetType(): number;
    }

    export class Time {
        time: number;
        offset: number;
    }

    namespace Trace {
        enum LEVEL {
            NONE = 0,
            FATAL = 1,
            ERROR = 2,
            WARN = 3,
            INFO = 4,
            DEBUG = 5,
            TRACE = 6
        }
    }

    export class Trace {}

    export class Transaction {}

    export class TransferProgress {
        totalObjects: number;
        indexedObjects: number;
        receivedObjects: number;
        localObjects: number;
        totalDeltas: number;
        indexedDeltas: number;
        receivedBytes: number;
    }

    namespace Transport {
        enum FLAGS {
            NONE = 0
        }
    }

    export class Transport {
        static sshWithPaths(owner: NodeGit.Remote, payload: void): Promise<NodeGit.Transport>;
        static unregister(prefix: string): number;
        init(version: number): number;
    }

    namespace Tree {
        enum WALK_MODE {
            WALK_PRE = 0,
            WALK_POST = 1
        }
    }

    export class Tree {
        static entryCmp(e1: NodeGit.TreeEntry, e2: NodeGit.TreeEntry): number;
        static entryDup(dest: NodeGit.TreeEntry, source: NodeGit.TreeEntry): number;
        static entryFilemode(entry: NodeGit.TreeEntry): number;
        static entryFilemodeRaw(entry: NodeGit.TreeEntry): number;
        static entryFree(entry: NodeGit.TreeEntry): void;
        static entryId(entry: NodeGit.TreeEntry): Oid;
        static entryName(entry: NodeGit.TreeEntry): string;
        static entryToObject(object_out: NodeGit.Object, repo: NodeGit.Repository, entry: NodeGit.TreeEntry): number;
        static entryType(entry: NodeGit.TreeEntry): number;
        static lookup(repo: NodeGit.Repository, id: string | Oid | Tree, callback: Function): Promise<NodeGit.Tree>;
        static lookupPrefix(repo: NodeGit.Repository, id: NodeGit.Oid, len: number): Promise<NodeGit.Tree>;

        entryById(id: NodeGit.Oid): TreeEntry;
        _entryByIndex(idx: number): TreeEntry;
        entryByName(name: string): TreeEntry;
        entryByPath(path: string): Promise<NodeGit.TreeEntry>;
        entryCount(): number;
        free(): void;
        id(): Oid;
        owner(): Repository;
        diff(tree: NodeGit.Tree, callback: Function): Promise<NodeGit.DiffFile[]>;
        diffWithOptions(tree: NodeGit.Tree, options: NodeGit.Object, callback: Function): Promise<NodeGit.DiffFile[]>;
        entryByIndex(i: number): TreeEntry;
        getEntry(filePath: string): TreeEntry;
        entries(): TreeEntry[];
        walk(blobsOnly?: Boolean): NodeJS.EventEmitter;
        path(): string;
        builder(): Treebuilder;
    }

    export class Treebuilder {
        static create(repo: NodeGit.Repository, source: NodeGit.Tree): Promise<NodeGit.Treebuilder>;

        clear(): void;
        entrycount(): number;
        free(): void;
        get(filename: string): TreeEntry;
        insert(filename: string, id: NodeGit.Oid, filemode: number): Promise<NodeGit.TreeEntry>;
        remove(filename: string): number;
        write(): Oid;
    }

    export class Writestream {}

    export class ConvenientPatch {
        oldFile(): DiffFile;
        newFile(): DiffFile;
        size(): number;
        hunks(): Promise<any[]>;
        status(): number;
        lineStats(): any;
        isUnmodified(): Boolean;
        isAdded(): Boolean;
        isDeleted(): Boolean;
        isModified(): Boolean;
        isRenamed(): Boolean;
        isCopied(): Boolean;
        isIgnored(): Boolean;
        isUntracked(): Boolean;
        isTypeChange(): Boolean;
        isUnreadable(): Boolean;
        isConflicted(): Boolean;
    }

}

declare module "nodegit" {
    export = NodeGit;
}