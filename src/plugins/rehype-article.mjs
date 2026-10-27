/** Keep Markdown content semantic so the site's existing typography can style it. */
export default function rehypeArticle({imageDimensions = {}} = {}) {
 return (tree) => {
  const text = (node) => node.type === 'text' ? node.value : (node.children ?? []).map(text).join('');
  const addClass = (node, value) => {
   node.properties ??= {};
   node.properties.className = [...(node.properties.className ?? []), value];
  };
  let references = false;
  let previous;
  tree.children = tree.children.map((node) => {
   if (node.type !== 'element') return node;
   if (node.tagName === 'h2') references = text(node).trim() === '参考资料';
   else if (references) addClass(node, 'article-reference');
   if (node.tagName === 'p' && previous?.tagName === 'h2' &&
       (node.children.length === 1 && node.children[0].tagName === 'strong' || text(node).startsWith('摘自：'))) {
    addClass(node, 'report-signature');
   }
   if (node.tagName === 'p' && node.children.length === 1 && node.children[0].tagName === 'img') {
    const image = node.children[0];
    Object.assign(image.properties, imageDimensions[image.properties.src] ?? {});
    image.properties.loading = 'lazy'; image.properties.decoding = 'async';
    node = {type:'element',tagName:'figure',properties:{className:['article-figure']},children:[
     image,{type:'element',tagName:'figcaption',properties:{},children:[{type:'text',value:image.properties.alt ?? ''}]},
    ]};
   }
   previous = node;
   return node;
  });
 };
}
