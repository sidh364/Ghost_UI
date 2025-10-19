import { forwardRef, useImperativeHandle } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Youtube from '@tiptap/extension-youtube'
import '../tiptap.css'

export type YoutubeEmbedHandle = {
  addVideo: (url: string, width?: number, height?: number) => void
}

const YoutubeEmbed = forwardRef<YoutubeEmbedHandle, { initialContent?: string }>((props, ref) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Youtube.configure({
        controls: false,
        nocookie: true,
      }),
    ],
    content: props.initialContent ?? '<p></p>',
    editorProps: {
      attributes: {
        spellcheck: 'false',
        class: 'tiptap',
      },
    },
  })

  useImperativeHandle(ref, () => ({
    addVideo: (url: string, width = 640, height = 480) => {
      if (!editor) return
      const w = Math.max(320, Number.parseInt(String(width), 10) || 640)
      const h = Math.max(180, Number.parseInt(String(height), 10) || 480)
      editor.commands.setYoutubeVideo({ src: url, width: w, height: h })
    },
  }), [editor])

  if (!editor) return null
  return <EditorContent editor={editor} />
})

export default YoutubeEmbed
