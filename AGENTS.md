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
- Render the same SubdivisionEnvironment during printing and neighborhood exploration, and derive printer/house placement from habitatPlacement; this keeps visible surroundings and the reserved home's coordinates identical across both scenes.
- Define scene material colors as semantic CSS tokens and convert them for Three.js inside the browser; this keeps the 3D view aligned with the design system.
- Share a generated print-ready habitat between the printer and parcel scenes; store completed sites only in map session state so finished homes match their reserved parcels without implying a saved purchase.
- Keep selectable Mars regions in a browser-safe data module shared by map controls and tests; regions without provided prices must not invent purchase values.
- Render the post-print subdivision in a separate client-side scene with pure parcel layout data and session completed homes; this preserves Mars selection and exact house placement on return.
- Keep nearby subdivision and civic destination coordinates in a browser-safe layout shared by terrain clearance, camera targets and tests; this prevents neighboring developments from intersecting terrain or moving reserved homes.
- Keep authorized illustrative featured offers as numeric area and currency data in a browser-safe module, separate from regional map pricing; this supports comparison tests without implying a regional purchase quote.
- Featured lot links pass the region identifier through the map route's validated search parameters; this opens the matching region without persisting a reservation.
