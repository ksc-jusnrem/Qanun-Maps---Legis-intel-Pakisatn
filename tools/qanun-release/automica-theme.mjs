// Adapted from the public JUS.automica design, production 0536a9b1.
// Existing locally hosted, licensed Cinzel/Garamond fonts are retained.
export const automicaCss = `
:root{--navy:#081828;--ink:#0f1a26;--muted:#46525e;--paper:#fff;--line:#0f1a2624;--silver:#d6dce2;--cyan:#62d8e8;--cyan-ink:#0b6b78;--gold:#d99b21;--green:#0b6b78;--deep-green:#081828;--soft-green:#eef2f6}
body{background:var(--paper);color:var(--ink);font-family:Garamond,Georgia,serif;font-size:19px;line-height:1.68}
body h1,body h2,body h3,.brand strong{font-family:Cinzel,Georgia,serif;font-weight:500;letter-spacing:.01em}
body .shell{width:min(1380px,100%)}
body header{display:flex;flex-wrap:wrap;align-items:center;gap:22px;padding:25px 0;border-bottom:1px solid var(--line)}
body .header-nav{display:flex;flex-wrap:wrap;gap:8px 22px;flex:1;justify-content:flex-end}
body .header-nav a{font-family:Cinzel,Georgia,serif;font-size:12px;letter-spacing:.035em;color:var(--navy);min-height:44px;display:inline-flex;align-items:center}
body .topline{background:var(--navy);color:#fff;font:12px/1.5 Garamond,Georgia,serif;padding-block:9px}
body .eyebrow{font:600 12px/1.4 Cinzel,Georgia,serif;letter-spacing:.1em;color:var(--cyan-ink)}
body .q-hero{padding:64px 0;gap:48px;align-items:center}
body .q-hero h1{font-family:Cinzel,Georgia,serif;font-size:clamp(38px,4.5vw,66px);line-height:1.12;letter-spacing:.01em}
body .q-hero h1 em{font-family:Garamond,Georgia,serif;font-size:1.12em;color:var(--cyan-ink)}
body .q-lead{font:22px/1.55 Garamond,Georgia,serif;color:var(--muted)}
body .q-questions{background:var(--navy);border-top:3px solid var(--gold);padding:32px;color:white}
body .q-questions h2,body .q-question{color:white}
body .q-questions .eyebrow,body .q-arrow{color:var(--cyan)}
body .q-question{border-color:#ffffff2e;font-size:19px;font-weight:400}
body .q-question small,body .q-questions>p{color:#d6e1eb;font:16px/1.55 Garamond,Georgia,serif}
body .q-search label{font-size:17px}body .q-search-note{font-size:15px}
body button.primary,body .primary,body .rule-page button{background:var(--navy);color:#fff;border:1px solid var(--navy)}
body .q-path h3{font-family:Cinzel,Georgia,serif;font-size:23px;color:var(--navy)}
body .q-path p,body .q-project p,body .q-method p,body .q-section-head p{font:19px/1.68 Garamond,Georgia,serif;color:var(--muted)}
body .q-project h2,body .q-method h2,body .q-section-head h2{font-family:Cinzel,Georgia,serif;font-size:clamp(27px,3vw,38px);line-height:1.2}
body .q-process strong{font-size:20px}body .q-process span{font-size:17px}
body .q-member{background:var(--navy);border-top:3px solid var(--gold)}
body .q-member h2{font-family:Cinzel,Georgia,serif;font-size:27px}body .q-member p{font-size:18px}
body .research-controls,body .library-page .searchbox,body .library-page .collection-info,body .reader-search,body .rule-toolbar,body .contents details>summary,body .q-project-reference{background:#eef2f6;border-color:var(--silver)}
body .reader-search small,body .reader-source-summary{color:var(--muted)}
body .reader-text{font:22px/1.7 Garamond,Georgia,serif;color:var(--ink)}
body .reading h1,body .research-page h1,body .q-page-head h1,body .rule-page h1{font-family:Cinzel,Georgia,serif;font-size:clamp(28px,3.5vw,46px);line-height:1.2}
body .rule-card h2,body .research-card h2,body .catalogue-card h3{font-family:Cinzel,Georgia,serif;font-size:25px;line-height:1.35}
body .intelligences{background:var(--navy);color:#fff;border-top:3px solid var(--gold)}
body .intelligences h2,body .intelligences strong{color:#fff}body .intelligences p{color:#d6e1eb}
body footer{background:#eef2f6;color:var(--navy);font-size:15px}
.q-philosophy{border-top:1px solid var(--line);padding:48px 0}.q-philosophy h2{font:500 clamp(27px,3vw,40px)/1.2 Cinzel,Georgia,serif;max-width:850px;margin:18px 0}.q-philosophy>p{max-width:850px;font-size:20px}.q-authority-chain{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);padding:0;margin:28px 0;border-top:1px solid var(--line);border-left:1px solid var(--line)}.q-authority-chain li{padding:24px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.q-authority-chain span{display:block;color:#7a4d00;font:13px Cinzel,Georgia,serif;margin-bottom:14px}.q-authority-chain strong{font:20px Cinzel,Georgia,serif}.q-authority-chain p{font:18px/1.6 Garamond,Georgia,serif;color:var(--muted);margin-bottom:0}.q-philosophy .q-attribution{font-size:16px;color:var(--muted)}
@media(max-width:900px){body .header-nav{flex-basis:100%;justify-content:flex-start}.q-authority-chain{grid-template-columns:1fr 1fr}}
@media(max-width:760px){body .q-hero{padding:34px 0;gap:28px}body .q-hero h1{font-size:clamp(34px,8vw,50px)}body .q-questions{padding:24px}body .reader-text{font-size:20px}body .topline{flex-wrap:wrap;gap:6px}body .q-member h2{font-size:24px}}
@media(max-width:480px){.q-authority-chain{grid-template-columns:1fr}body .header-nav{gap:5px 16px}body .q-path h3{font-size:21px}}
@media print{body{background:white;color:black}body .q-questions,body .q-member{background:white;color:black}body .q-questions h2,body .q-question,body .q-question small,body .q-questions>p,body .q-member h2,body .q-member p{color:black}body .reader-text{font-size:12pt}.q-authority-chain{break-inside:avoid}}
`;

export const automicaPhilosophy = `<section class="q-philosophy" aria-labelledby="philosophy-title"><div class="eyebrow">THE JURISPRUDENTIAL FOUNDATION · JUS.AUTOMICA</div><h2 id="philosophy-title">Legal authority must remain traceable.</h2><p>Qanun Maps applies a research principle developed in JUS.automica: making law computable must preserve the sources, interpretation, reasons and responsibility on which legal authority depends.</p><ol class="q-authority-chain" aria-label="How this principle guides Qanun Maps"><li><span>I · SOURCE</span><strong>Read the law</strong><p>Begin with an identified instrument, its recorded origin and the exact held text.</p></li><li><span>II · INTERPRETATION</span><strong>Expose the connection</strong><p>Distinguish the source provision from a proposed mapping or judicial interpretation.</p></li><li><span>III · EVIDENCE</span><strong>Keep reasons visible</strong><p>Follow supporting passages, editions and review limits. Missing evidence remains visible.</p></li><li><span>IV · REVIEW</span><strong>Retain human judgment</strong><p>Inspect and question a connection. A research result does not decide legal rights or replace an available remedy.</p></li></ol><p class="q-attribution">Adapted for this research workspace from <a href="https://www.jus-automica.digital/">JUS.automica: A Jurisprudence of the Intelligent Order</a>, by Khurram Chughtai. These are guiding research principles; Qanun Maps does not make binding legal determinations.</p></section>`;
