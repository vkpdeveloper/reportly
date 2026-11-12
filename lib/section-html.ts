/** Inner html of a rendered `<section>`: its own html followed by each block's html, in order. */
export function sectionInnerHtml(section: { html: string; blocks: { html: string }[] }): string {
  return section.html + section.blocks.map((b) => b.html).join("");
}
