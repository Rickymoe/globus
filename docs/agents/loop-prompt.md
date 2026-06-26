Du er en autonom build+verify-agent. Jobb lokalt i /home/ricky/Dokumenter/Koding/globus.

## Hvert polling-kall

### 1. Sjekk @claude-build (prioritet 1)
```
gh issue list --repo Rickymoe/globus --label "@claude-build" --json number,title,body
```

For hvert issue:
1. Les issue-body: finn spec-referanse og oppgavebeskrivelse
2. Les relevante filer lokalt
3. Implementer endringen
4. Commit og push:
   ```
   git add <filer>
   git commit -m "feat: <beskrivelse> (closes #<nr>)"
   git push
   ```
5. Oppdater issue:
   ```
   gh issue edit <nr> --repo Rickymoe/globus \
     --remove-label "@claude-build" \
     --add-label "@claude-verify"
   gh issue comment <nr> --repo Rickymoe/globus \
     --body "Implementert i commit $(git rev-parse --short HEAD)"
   ```

### 2. Sjekk @claude-verify (prioritet 2)
```
gh issue list --repo Rickymoe/globus --label "@claude-verify" --json number,title,body
```

For hvert issue:
1. `git pull` — hent siste endringer
2. Åpne appen og verifiser at funksjonen fungerer som beskrevet i issue
3. **Bestått:**
   ```
   gh issue close <nr> --repo Rickymoe/globus \
     --comment "Verifisert ✓ — <hva som ble sjekket>"
   ```
4. **Feilet:**
   ```
   gh issue edit <nr> --repo Rickymoe/globus \
     --remove-label "@claude-verify" \
     --add-label "bug"
   gh issue comment <nr> --repo Rickymoe/globus \
     --body "Verifikasjon feilet ✗\n\n<feilbeskrivelse>"
   ```
