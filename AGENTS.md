<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the post-reservation house-printing experience in a separate client-side Three.js scene, passing the selected region and parcel from the map; this preserves map selection on return without implying a persisted reservation.
- Define scene material colors as semantic CSS tokens and convert them for Three.js inside the browser; this keeps the 3D view aligned with the design system.
- Share a generated print-ready habitat between the printer and parcel scenes; store completed sites only in map session state so finished homes match their reserved parcels without implying a saved purchase.
