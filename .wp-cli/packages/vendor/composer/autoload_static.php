<?php

// autoload_static.php @generated by Composer

namespace Composer\Autoload;

class ComposerStaticInit26c2069e1852faaa0f0160f99e5dcbaa
{
    public static $files = array (
        '979475126cb92029d44de65e48caa114' => __DIR__ . '/..' . '/vccw/scaffold-vccw/cli.php',
    );

    public static $fallbackDirsPsr4 = array (
        0 => __DIR__ . '/..' . '/vccw/scaffold-vccw/src',
    );

    public static function getInitializer(ClassLoader $loader)
    {
        return \Closure::bind(function () use ($loader) {
            $loader->fallbackDirsPsr4 = ComposerStaticInit26c2069e1852faaa0f0160f99e5dcbaa::$fallbackDirsPsr4;

        }, null, ClassLoader::class);
    }
}
