import type { SVGProps } from 'react';

const variants = {
    primary: {
        circle1: 'stroke-primary',
        circle2: 'hidden',
        path: 'fill-primary',
    },
    secondary: {
        circle1: 'hidden',
        circle2: 'fill-secondary',
        path: 'fill-[#222222]',
    },
} as const;

function Feces({ color = 'primary', ...props }: Props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
            <circle cx={12} cy={12} r={11.5} className={variants[color].circle1} />
            <circle cx={12} cy={12} r={12} className={variants[color].circle2} />
            <path
                className={variants[color].path}
                d="M11.52 4.5c-.157 0-.367.09-.592.24-.428.285-1.29 1.185-1.628 2.085-.255.675-.263 1.29-.158 1.747-.42.076-.727.21-.847.263-.383.165-1.193.885-1.268 2.002-.022.39.03.788.15 1.163-.495.143-.78.322-.802.33-.24.09-.638.367-.75.518a2.5 2.5 0 0 0-.533 1.027c-.217.818-.142 1.748.255 2.497.218.42.518.878.848 1.2 1.08 1.11 2.94 1.53 4.41 1.77 1.793.3 3.668.196 5.34-.494 2.512-1.043 3.18-2.723 3.285-3.18.218-1.043-.053-2.025-.165-2.265a1.95 1.95 0 0 0-.878-.923 2.5 2.5 0 0 0-.757-.33c.195-.713-.082-1.275-.465-1.695-.578-.615-1.17-.705-1.17-.705a1.82 1.82 0 0 0 .165-1.26 1.62 1.62 0 0 0-.795-1.095c-.39-.232-.87-.345-1.365-.435-.24-.045-1.238-.187-1.65-.758-.338-.465-.345-1.304-.435-1.552-.037-.098-.09-.15-.195-.15M15 10.208c.053 0 .098.007.143.007 1.072.12 1.837 1.155 1.71 2.303-.128 1.147-1.103 1.987-2.176 1.867-1.072-.135-1.837-1.147-1.71-2.302.12-1.088 1.013-1.913 2.033-1.876m-5.535 0c.998.03 1.83.877 1.905 1.95.09 1.155-.712 2.152-1.785 2.235h-.008c-1.072.082-2.017-.788-2.107-1.943-.083-1.155.72-2.152 1.792-2.235q.101-.01.203-.008m.015 1.274c-.03 0-.053 0-.083.008a.765.765 0 0 0-.574 1.128.75.75 0 0 0 .754.372.776.776 0 0 0 .675-.848.757.757 0 0 0-.772-.66m5.475.016a.764.764 0 0 0-.695 1.004.75.75 0 0 0 .672.503.756.756 0 1 0 .105-1.508zm-5.423 3.615c.218-.008.413.06.593.097.885.165 1.65.188 2.018.188s1.124-.023 2.002-.188c.308-.06.66-.187.938 0 .36.24.097 1.102-.458 1.688a3.4 3.4 0 0 1-2.482 1.035 3.38 3.38 0 0 1-2.483-1.035c-.555-.585-.818-1.448-.465-1.688a.6.6 0 0 1 .337-.098"
            />
        </svg>
    );
}

type Color = keyof typeof variants;

interface Props extends Omit<SVGProps<SVGSVGElement>, 'color'> {
    color?: Color;
}

export { Feces };
