#!/usr/bin/env bash
# board.sh — thin wrapper over the private "portfolio" GitHub Project (users/stephenlyons18/projects/2).
#
# Work items live on the board as *draft items* (private — not public repo issues). Each item's title
# keeps its id ("R7 — …") so commits, branches and PRs stay greppable. When a PR is opened for an item,
# `link` adds the PR to the board, carries Priority/Size over, and archives the draft: from then on the
# PR is the card. Repo issues are reserved for security findings; `add-issue` puts one on the board.
#
# Needs gh with the `project` scope (`gh auth refresh -s project`). One small GraphQL query per call —
# don't loop it.
#
# Usage:
#   tools/board.sh list [column]                      cards, optionally one column
#   tools/board.sh show <item>                        title, fields and body
#   tools/board.sh new <column> <P0|P1|P2> <XS..XL> <title> [body-file]
#   tools/board.sh move <item> <column>
#   tools/board.sh state <item> <column> <text>       move + rewrite the item's "> **State …" line
#                                                     (for a PR card the line is posted as a PR comment)
#   tools/board.sh link <item> <pr-number>            PR becomes the card (In review), draft archived
#   tools/board.sh add-issue <issue-number> [column]  put a (security) issue on the board
#   tools/board.sh next-id                            next free R-number
#
# <item> is an id prefix (R7), "#<n>" for a PR/issue number, or a PVTI_… node id.
# Columns: Backlog | Ready | "In progress" | "In review" | Done
set -euo pipefail

OWNER=stephenlyons18
REPO=stephenlyons18/stephenlyons18.github.io
NUMBER=2
PROJECT=PVT_kwHOA1EB8s4BmnpX
# Field / option ids — refresh with: gh project field-list 2 --owner stephenlyons18 --format json
F_STATUS=PVTSSF_lAHOA1EB8s4BmnpXzhlP5uI
F_PRIORITY=PVTSSF_lAHOA1EB8s4BmnpXzhlP50I
F_SIZE=PVTSSF_lAHOA1EB8s4BmnpXzhlP50M

# gh occasionally gets an HTML error page back from the GraphQL endpoint; retry those, not real errors.
gh() {
  local out n
  for n in 1 2 3; do
    if out=$(command gh "$@" 2>&1); then printf '%s' "$out"; [ -n "$out" ] && echo; return 0; fi
    case "$out" in *"invalid character '<'"*|*"502"*|*"503"*|*"timeout"*) sleep $((n * 2)) ;; *) echo "$out" >&2; return 1 ;; esac
  done
  echo "$out" >&2; return 1
}

status_opt() {
  case "$1" in
    Backlog) echo f75ad846 ;; Ready) echo 61e4505c ;; "In progress") echo 47fc9ee4 ;;
    "In review") echo df73e18b ;; Done) echo 98236657 ;;
    *) echo "unknown column: $1" >&2; exit 2 ;;
  esac
}
priority_opt() { case "$1" in P0) echo 79628723 ;; P1) echo 0a877460 ;; P2) echo da944a9c ;; *) echo "bad priority: $1" >&2; exit 2 ;; esac; }
size_opt() {
  case "$1" in XS) echo 6c6483d2 ;; S) echo f784b110 ;; M) echo 7515a9f1 ;; L) echo 817d0097 ;; XL) echo db339eb2 ;;
    *) echo "bad size: $1" >&2; exit 2 ;; esac
}

# All non-archived cards as TSV: itemId  type  contentId  number  status  priority  size  title
items_tsv() {
  gh api graphql -f query='
    query($p: ID!) { node(id: $p) { ... on ProjectV2 { items(first: 100) { nodes {
      id
      status:   fieldValueByName(name: "Status")   { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      priority: fieldValueByName(name: "Priority") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      size:     fieldValueByName(name: "Size")     { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      content {
        __typename
        ... on DraftIssue  { id title }
        ... on Issue       { id number title }
        ... on PullRequest { id number title }
      } } } } } }' -f p="$PROJECT" --jq '.data.node.items.nodes[] |
      [.id, .content.__typename, .content.id, (.content.number // "-"), (.status.name // "-"),
       (.priority.name // "-"), (.size.name // "-"), .content.title] | @tsv'
}

# Resolve <item> to one TSV row.
resolve() {
  local key="$1" rows
  rows=$(items_tsv)
  local hit
  case "$key" in
    PVTI_*) hit=$(awk -F'\t' -v k="$key" '$1==k' <<<"$rows") ;;
    \#*)    hit=$(awk -F'\t' -v k="${key#\#}" '$4==k' <<<"$rows") ;;
    *)      hit=$(awk -F'\t' -v k="$key" 'index($8, k" ")==1 || index($8, k" —")==1' <<<"$rows") ;;
  esac
  if [ -z "$hit" ]; then echo "no card matches '$key'" >&2; exit 1; fi
  if [ "$(wc -l <<<"$hit")" -gt 1 ]; then echo "ambiguous '$key':" >&2; echo "$hit" >&2; exit 1; fi
  echo "$hit"
}

set_select() { # itemId fieldId optionId
  gh api graphql -f query='mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(
      input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ clientMutationId } }' \
    -f p="$PROJECT" -f i="$1" -f f="$2" -f o="$3" >/dev/null
}

draft_body() { gh api graphql -f query='query($i:ID!){ node(id:$i){ ... on DraftIssue { body } } }' -f i="$1" --jq .data.node.body; }

cmd="${1:-}"; shift || true
case "$cmd" in
  list)
    items_tsv | awk -F'\t' -v col="${1:-}" 'col=="" || $5==col {
      ref = ($2=="DraftIssue") ? "draft" : (($2=="PullRequest") ? "PR #"$4 : "issue #"$4)
      printf "%-12s %-3s %-3s %-10s %s\n", $5, $6, $7, ref, $8 }' | sort
    ;;
  show)
    row=$(resolve "$1"); IFS=$'\t' read -r id type cid num st pr sz title <<<"$row"
    echo "$title"; echo "status=$st priority=$pr size=$sz type=$type number=$num item=$id"; echo
    case "$type" in
      DraftIssue)  draft_body "$cid" ;;
      PullRequest) gh pr view "$num" -R "$REPO" --json body,comments --jq '.body, (.comments[] | "--- " + .author.login + ": " + .body)' ;;
      Issue)       gh issue view "$num" -R "$REPO" --json body,comments --jq '.body, (.comments[] | "--- " + .author.login + ": " + .body)' ;;
    esac
    ;;
  new)
    col="$1" pri="$2" size="$3" title="$4" bodyfile="${5:-}"
    body=""; [ -n "$bodyfile" ] && body=$(cat "$bodyfile")
    body="> **State $(date +%F) → $col:** created."$'\n\n'"$body"
    id=$(gh project item-create "$NUMBER" --owner "$OWNER" --title "$title" --body "$body" --format json --jq .id)
    set_select "$id" "$F_STATUS" "$(status_opt "$col")"
    set_select "$id" "$F_PRIORITY" "$(priority_opt "$pri")"
    set_select "$id" "$F_SIZE" "$(size_opt "$size")"
    echo "$id  $title → $col"
    ;;
  move)
    row=$(resolve "$1"); id=${row%%$'\t'*}
    set_select "$id" "$F_STATUS" "$(status_opt "$2")"; echo "moved → $2"
    ;;
  state)
    row=$(resolve "$1"); IFS=$'\t' read -r id type cid num _ _ _ title <<<"$row"
    col="$2" text="$3" line="> **State $(date +%F) → $2:** $3"
    set_select "$id" "$F_STATUS" "$(status_opt "$col")"
    if [ "$type" = DraftIssue ]; then
      old=$(draft_body "$cid")
      new=$(printf '%s\n' "$old" | awk -v l="$line" 'BEGIN{d=0} /^> \*\*State /{ if(!d){print l; d=1}; next } {print} END{ if(!d) print l }')
      gh api graphql -f query='mutation($i:ID!,$b:String!){ updateProjectV2DraftIssue(input:{draftIssueId:$i,body:$b}){ clientMutationId } }' \
        -f i="$cid" -f b="$new" >/dev/null
    else
      gh api "repos/$REPO/issues/$num/comments" -f body="$line" >/dev/null
    fi
    echo "$title → $col"
    ;;
  link)
    row=$(resolve "$1"); IFS=$'\t' read -r id type _ _ _ pri sz title <<<"$row"
    [ "$type" = DraftIssue ] || { echo "$1 is not a draft" >&2; exit 1; }
    url="https://github.com/$REPO/pull/$2"
    pid=$(gh project item-add "$NUMBER" --owner "$OWNER" --url "$url" --format json --jq .id)
    set_select "$pid" "$F_STATUS" "$(status_opt "In review")"
    [ "$pri" != - ] && set_select "$pid" "$F_PRIORITY" "$(priority_opt "$pri")"
    [ "$sz" != - ] && set_select "$pid" "$F_SIZE" "$(size_opt "$sz")"
    gh project item-archive "$NUMBER" --owner "$OWNER" --id "$id" >/dev/null
    echo "$title → PR #$2 (In review); draft archived"
    ;;
  add-issue)
    url="https://github.com/$REPO/issues/$1"
    iid=$(gh project item-add "$NUMBER" --owner "$OWNER" --url "$url" --format json --jq .id)
    set_select "$iid" "$F_STATUS" "$(status_opt "${2:-Ready}")"; echo "issue #$1 → ${2:-Ready}"
    ;;
  next-id)
    # Archived drafts still own their ids, so read titles from PRs too.
    { items_tsv | cut -f8; gh pr list -R "$REPO" --state all --limit 200 --json title --jq '.[].title'; } |
      grep -oE '^R[0-9]+' | tr -d R | sort -n | tail -1 | awk '{print "R" $1+1} END{ if(NR==0) print "R1" }'
    ;;
  *)
    sed -n '2,25p' "$0"; exit 2 ;;
esac
