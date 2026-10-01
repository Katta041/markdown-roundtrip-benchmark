Edge case torture test
======================

Setext H2
---------

#Not a heading (no space)
# ATX heading with closing hashes #
##   Extra spaces heading

*Star emphasis* and _underscore emphasis_, **star strong** and __underscore strong__, ***both***.

Lists with different markers:

* star item
* star item

- dash item
- dash item

+ plus item
+ plus item

Loose list:

- item one

- item two

Ordered starting at 7 with paren:

7) seven
8) eight

Ordered with all ones:

1. one
1. two
1. three

Nested four-space indent:

- parent
    - child with 4 spaces
        - grandchild

Tight list followed by paragraph
- a
- b
Text right after list (lazy continuation).

Hard breaks: two spaces  
backslash\
end.

Trailing spaces on this line   
Tab	inside	text.

HTML inline: <kbd>Ctrl</kbd>+<kbd>C</kbd>, <mark>highlight</mark>, <br> and <sup>1</sup>.

Entities: &copy; &amp; &lt;tag&gt; &#8212; &#x2014; &nbsp;.

Autolinks: <https://example.com> and bare https://example.org/path?q=1&r=2 and email <sec@example.com>.

Links: [inline](https://a.example "Title"), [ref][r1], [collapsed][], [shortcut].

[r1]: https://r1.example
[collapsed]: https://collapsed.example
[shortcut]: <https://shortcut.example> 'single quoted title'

Code spans: `` `backticks` inside ``, ` leading space`, `a|b`.

````markdown
Four-backtick fence containing a fence:
```js
console.log("nested")
```
````

~~~~
tilde fence with no language
~~~~

Table without leading/trailing pipes:

Col A | Col B | Col C
:-- | :-: | --:
left | center | right
`x|y` | a \| b | **bold**

Table with uneven padding:

|a|b|
|-|-|
|1|2|
|  3  |    4|

Blockquote with lazy continuation:
> quoted line one
continued lazily
> > nested quote

Horizontal rules in three styles:

***
___
- - -

Thematic break vs setext ambiguity:

Paragraph
***

Final line without trailing newline
