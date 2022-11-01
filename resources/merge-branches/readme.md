# Keeping release branches in sync

Since we might have several release branches at a given point we have automated the process of keeping them in sync.
Having the process done automatically reduces the chances of human errors during the merges and ensure branches are
kept in sync usign the right sequence of commands.

To keep the branches in sync execute the following command

```bash
./bnr mergeBranches [--remote] [--no-pull] [--no-merge] [--no-push] [--no-validate] [--cmdPrefix] [--branches] [--dryRun]
```

### `mergeBranches` task configuration
The command will read some configuration values from the file [merge-branches.config.js](merge-branches.config.js). These
values are:

- `branchesToMerge`: Which branches to keep in sync, by default they are:

  ```js
  branchesToMerge = ['19.05.27', '19.06.10', '19.06.24', '19.07.08', '19.07.22', 'master']
  ```

- `commitsToVerify`: which commits to check on which branches. By default we are checking for a commit that
  is in master that should not be in any of the release branches:

  ```js
  // these commits should not be on the release branches
  commitsToVerify = [{
    // PR that was reverted that should be in master but appeared
    // in 19.06.24 https://github.com/Redisrupt/red/pull/9177
    sha: '11150c2',
    skipFor: ['master'], // since this commit is from master we should skip validating its presence in that branch
  }];
  ```

- `remote`: Which remote to use. By default is `origin`, but in some cases it can be `upstream` like when you
  have own fork of the project as the default remote.

### CLI options.

Other options that can be specified when executing the cli command are:

- `--dryRun`: Whether or not to execute the commands. If true it will just print the
  list of commands that would be executed. Useful to execute a manual merge of the branches
- `--remote`: Which remote to use. Overrides the default one set on the
  [merge-branches.config.js](merge-branches.config.js) config file.
- `--no-pull`: Whether to create or not pull commands to get the latest from the remote branches
- `--no-merge`: Whether to create or not merge commands to merge the release branches from older to newer.
- `--no-push`: Whether to push automatically the synced branch to the remote.
- `--no-validate`: Whether to validate or not that merge is correct checking for merge commit messages
  and specific commits defined in the [merge-branches.config.js](merge-branches.config.js)
  config file
- `--cmdPrefix`: whether to add a prefix to the generated shell command specially useful when using the `--dryRun` option
  to generate the commands to be executed manually in shells like `xsh` that require the commands to be prefixed with `$`
- `--branches`: Which branches to keep in sync. If specified it overrides the default ones set in the
  [merge-branches.config.js](merge-branches.config.js) config file.

### Examples

```bash
# Merge branches using default config values set in resources/merge-branches/merge-branches.config.js
./bnr mergeBranches

# Merge branches using upstream as the remote overriding the remote in the config file
./bnr mergeBranches --remote upstream

# Print a list of commands that would be executed in the shell
./bnr mergeBranches --dryRun

# Especify the branches to merge. Please note that branches is an array that's why we need to specify it several times
./bnr mergeBranches --branches 19.07.08 --branches 19.07.22 --branches master
```
